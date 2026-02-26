# C:\Users\Usuario\Desktop\proyectos\poker_boss\modules\workers\worker_loop.py
import os
import time
import json
from typing import Any, Dict, List, Optional, Tuple

from modules.workers.worker_utils import get_fingerprint, list_images_in_dir, safe_capture
from modules.workers.worker_preflop import run_preflop
from modules.workers.worker_dedupe import normalize_p1, compute_can_persist, compute_sig, apply_dedupe
from modules.workers.worker_strategy import compute_strategy
from modules.workers.worker_persist import build_ocr_json, persist_obs


def _select_mode(image_path: Optional[str], images_dir: Optional[str]) -> str:
    if images_dir:
        return "replay_dir"
    if image_path:
        return "replay"
    return "screen"


def _get_image_for_tick(
    mode: str,
    *,
    image_path: Optional[str],
    images_dir: Optional[str],
    loop: bool,
    region: Optional[List[int]],
    dir_state: Dict[str, Any],
) -> Tuple[Optional[str], str, List[str], Optional[str]]:
    """
    Returns: img_path, image_or_region, errors, cleanup_path (if screen capture temp)
    """
    errors: List[str] = []
    cleanup_path: Optional[str] = None

    if mode == "replay":
        img_path = image_path
        image_or_region = os.path.abspath(img_path) if img_path else "missing"
        if not img_path or not os.path.exists(img_path):
            errors.append("replay image not found")
            return None, image_or_region, errors, None
        return img_path, image_or_region, errors, None

    if mode == "replay_dir":
        if not images_dir or not os.path.isdir(images_dir):
            errors.append("images_dir not found")
            return None, (images_dir or "missing"), errors, None

        if not dir_state.get("files"):
            dir_state["files"] = list_images_in_dir(images_dir)

        files: List[str] = dir_state.get("files", [])
        if not files:
            errors.append("images_dir empty (no .bmp/.png)")
            return None, images_dir, errors, None

        idx = int(dir_state.get("idx", 0))
        if idx >= len(files):
            if loop:
                idx = 0
            else:
                return None, images_dir, errors, "DONE"

        img_path = files[idx]
        dir_state["idx"] = idx + 1
        if not os.path.exists(img_path):
            errors.append("image missing in dir")
            return None, img_path, errors, None
        return img_path, img_path, errors, None

    # screen
    if region is None or len(region) != 4:
        errors.append("region required for screen mode")
        return None, "missing", errors, None

    image_or_region = f"{region[0]},{region[1]},{region[2]},{region[3]}"
    img_path, err = safe_capture(region)
    if err or not img_path:
        errors.append(f"capture failed: {err}")
        return None, image_or_region, errors, None

    cleanup_path = img_path
    return img_path, image_or_region, errors, cleanup_path


def _ms(dt_s: float) -> float:
    return round(dt_s * 1000.0, 2)


def run_loop(args: Any) -> None:
    worker_id = args.id
    interval_ms = args.interval_ms
    image_path = args.image
    images_dir = args.images_dir
    loop = (args.loop or "").lower() == "true"
    region = args.region
    max_ticks = args.max_ticks
    print_every_tick = (args.print_every_tick or "").lower() == "true"
    persist_without_stack = (args.persist_without_stack or "").lower() == "true"

    mode = _select_mode(image_path, images_dir)

    last_hand_sig: Optional[str] = None
    tick = 0

    # DB integration
    from modules.db import db as dbmod

    # OCR orchestrator
    from modules.ocr.ocr import run_ocr

    # Strategy selector
    try:
        from modules.strategy.substrategy_selector import MatchInput, select_move
    except Exception:
        MatchInput = None  # type: ignore
        select_move = None  # type: ignore

    dir_state: Dict[str, Any] = {"files": [], "idx": 0}
    if mode == "replay_dir" and images_dir:
        images_dir = os.path.abspath(images_dir)
        dir_state["files"] = list_images_in_dir(images_dir)

    try:
        while True:
            tick += 1
            ts = time.time()

            t_tick0 = time.perf_counter()

            # --- get image
            t0 = time.perf_counter()
            img_path, image_or_region, errors, cleanup_path = _get_image_for_tick(
                mode,
                image_path=image_path,
                images_dir=images_dir,
                loop=loop,
                region=region,
                dir_state=dir_state,
            )
            if cleanup_path == "DONE":
                break
            t_get_image = time.perf_counter()

            # --- preflop
            t1 = time.perf_counter()
            preflop = run_preflop(img_path) if img_path else {"error": "no image", "preflop_ok": False}
            t_preflop = time.perf_counter()

            # --- ocr
            t2 = time.perf_counter()
            ocr: Dict[str, Any] = {"ok": False, "errors": ["no_image"], "names": {}, "villano": {}, "stackefectivo": {}, "bets": {}, "stacks": {}}
            if img_path:
                try:
                    ocr = run_ocr(img_path)
                except Exception as e:
                    ocr = {"ok": False, "errors": [f"run_ocr:{e}"], "names": {}, "villano": {}, "stackefectivo": {}, "bets": {}, "stacks": {}}
            t_ocr = time.perf_counter()

            mano_result: Dict[str, Any] = {"valid": False, "mano_raw": None}
            stacks_result: Dict[str, Any] = {"p1": None}  # legacy
            if isinstance(preflop, dict):
                mods = preflop.get("modules")
                if isinstance(mods, dict):
                    mano_result = mods.get("mano", mano_result)
                    stacks_result = mods.get("stacks", stacks_result)

            ocr_stacks = ocr.get("stacks", {}) if isinstance(ocr, dict) else {}
            bets_result = ocr.get("bets", {}) if isinstance(ocr, dict) else {}
            stackefectivo_result = ocr.get("stackefectivo", {}) if isinstance(ocr, dict) else {}
            names_result = ocr.get("names", {}) if isinstance(ocr, dict) else {}
            villano_result = ocr.get("villano", {}) if isinstance(ocr, dict) else {}

            fingerprint = get_fingerprint(worker_id, mode, image_or_region)

            p1 = normalize_p1(stacks_result, ocr_stacks)
            can_persist = compute_can_persist(mano_result, p1, persist_without_stack)

            sig: Optional[str] = None
            if can_persist:
                sig = compute_sig(mano_result, p1, persist_without_stack)

            dedupe_skipped, dedupe_reason, last_hand_sig = apply_dedupe(can_persist, sig, last_hand_sig)

            # --- strategy
            t3 = time.perf_counter()
            strategy = compute_strategy(
                preflop=preflop,
                mano_result=mano_result,
                ocr=ocr,
                bets_result=bets_result,
                ocr_stacks=ocr_stacks,
                stackefectivo_result=stackefectivo_result,
                villano_result=villano_result,
                MatchInput=MatchInput,
                select_move=select_move,
            )
            t_strategy = time.perf_counter()

            # --- persist
            t4 = time.perf_counter()
            persisted = False
            if (not dedupe_skipped) and can_persist and sig:
                ocr_json = build_ocr_json(
                    mano_result=mano_result,
                    stacks_result=stacks_result,
                    ocr=ocr,
                    preflop=preflop,
                    strategy=strategy,
                    tempo_s=round((time.perf_counter() - t0), 3),
                )
                persist_obs(
                    dbmod,
                    sig=sig,
                    ts=ts,
                    mano_result=mano_result,
                    preflop=preflop,
                    ocr_json=ocr_json,
                )
                persisted = True
            t_persist = time.perf_counter()

            tempo_s = round((time.perf_counter() - t0), 3)

            timing_ms = {
                "get_image": _ms(t_get_image - t0),
                "preflop": _ms(t_preflop - t1),
                "ocr": _ms(t_ocr - t2),
                "strategy": _ms(t_strategy - t3),
                "persist": _ms(t_persist - t4),
                "tick_total": _ms(time.perf_counter() - t_tick0),
            }

            out = {
                "worker_id": worker_id,
                "mode": mode,
                "tick": tick,
                "ts": ts,
                "tempo_s": tempo_s,
                "timing_ms": timing_ms,
                "persisted": persisted,
                "preflop": preflop,
                "ocr": ocr,
                "strategy": strategy,
                "mano_result": mano_result,
                "stacks_result": stacks_result,
                "ocr_stacks": ocr_stacks,
                "bets_result": bets_result,
                "stackefectivo_result": stackefectivo_result,
                "names_result": names_result,
                "villano_result": villano_result,
                "errors": errors,
                "fingerprint": fingerprint,
                "dedupe_skipped": dedupe_skipped,
                "dedupe_reason": dedupe_reason,
                "image_ref": image_or_region,
                "persist_without_stack": persist_without_stack,
            }

            if print_every_tick:
                print(json.dumps(out, ensure_ascii=False))

            if mode == "screen" and cleanup_path:
                try:
                    os.remove(cleanup_path)
                except Exception:
                    pass

            if max_ticks is not None and tick >= max_ticks:
                break

            time.sleep(interval_ms / 1000.0)

    except KeyboardInterrupt:
        print(json.dumps({"worker_id": worker_id, "event": "shutdown", "ts": time.time()}, ensure_ascii=False))
