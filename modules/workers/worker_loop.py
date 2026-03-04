# C:\Users\Usuario\Desktop\proyectos\poker_boss\modules\workers\worker_loop.py
from __future__ import annotations

import os
import time
import json
import shutil
from typing import Any, Dict, Optional

from modules.workers.worker_utils import get_fingerprint, list_images_in_dir
from modules.workers.worker_preflop import run_preflop
from modules.workers.worker_dedupe import (
    normalize_p1,
    compute_can_persist,
    compute_sig,
    apply_dedupe,
)
from modules.workers.worker_strategy import compute_strategy
from modules.workers.worker_persist import build_ocr_json, persist_obs

from .worker_loop_types import LoopConfig, ReplayDirState, Timing
from .worker_loop_image import select_mode, get_image_for_tick, safe_remove
from .worker_loop_logic import parse_bool, ensure_ocr_shape, extract_preflop_modules


def _ensure_dir(path: str) -> None:
    os.makedirs(path, exist_ok=True)


def _is_preflop_borrar(preflop: Any) -> bool:
    """
    True if preflop failed due to:
      - no cards (mano.valid == False OR mano.mano_ok == False)
      - noboard == false (noboard_ok == False)
    If structure is missing/unknown, we treat as borrar to keep dataset clean.
    """
    if not isinstance(preflop, dict):
        return True

    mods = preflop.get("modules", {})
    if not isinstance(mods, dict):
        return True

    mano = mods.get("mano", {})
    noboard = mods.get("noboard", {})

    mano_ok = True
    noboard_ok = True

    if isinstance(mano, dict):
        if "mano_ok" in mano:
            mano_ok = bool(mano.get("mano_ok"))
        elif "valid" in mano:
            mano_ok = bool(mano.get("valid"))

    if isinstance(noboard, dict) and "noboard_ok" in noboard:
        noboard_ok = bool(noboard.get("noboard_ok"))

    return (not mano_ok) or (not noboard_ok)


def _is_strategy_error(strategy: Any) -> bool:
    """
    True when strategy has an error or is explicitly not ok.
    """
    if not isinstance(strategy, dict):
        return True
    if strategy.get("error"):
        return True
    if strategy.get("ok") is False:
        return True
    return False


def _move_image(src_path: str, dst_dir: str) -> Optional[str]:
    """Move file to dst_dir. Returns destination path on success, else None."""
    try:
        _ensure_dir(dst_dir)
        base = os.path.basename(src_path)
        dst_path = os.path.join(dst_dir, base)

        # Avoid overwriting existing file: add suffix
        if os.path.exists(dst_path):
            root, ext = os.path.splitext(base)
            k = 1
            while True:
                cand = os.path.join(dst_dir, f"{root}__{k}{ext}")
                if not os.path.exists(cand):
                    dst_path = cand
                    break
                k += 1

        shutil.move(src_path, dst_path)
        return dst_path
    except Exception:
        return None


def _update_db_frame_ref(dbmod: Any, fingerprint: str, new_frame_ref: str) -> bool:
    """
    Update hands_obs.frame_ref after moving the image, so DB always points to the real file path.
    """
    try:
        conn = dbmod.get_conn()
        cur = conn.cursor()
        cur.execute(
            "UPDATE hands_obs SET frame_ref = ? WHERE fingerprint = ?",
            (new_frame_ref, fingerprint),
        )
        conn.commit()
        return True
    except Exception:
        return False


def _route_replay_dir_image(
    img_path: str,
    images_dir: str,
    persisted: bool,
    preflop: Any,
    strategy: Any,
) -> Dict[str, Any]:
    """
    Routing rules (priority):
      1) Preflop fail (no cards OR noboard=false) -> borrar
      2) Strategy error -> errors (even if persisted happened)
      3) OK only if persisted == True AND strategy ok -> ok
      else -> errors
    """
    ok_dir = os.path.join(images_dir, "ok")
    err_dir = os.path.join(images_dir, "errors")
    del_dir = os.path.join(images_dir, "borrar")

    # 1) Preflop failures -> borrar
    if _is_preflop_borrar(preflop):
        dst = _move_image(img_path, del_dir)
        return {
            "route": "borrar",
            "reason": "preflop_no_cards_or_noboard_false",
            "moved": bool(dst),
            "dst": dst,
        }

    # 2) Strategy error -> errors
    if _is_strategy_error(strategy):
        reason = "strategy_error"
        if isinstance(strategy, dict):
            if strategy.get("error"):
                reason = f"strategy_error:{strategy.get('error')}"
            elif strategy.get("reason"):
                reason = f"strategy_not_ok:{strategy.get('reason')}"
        dst = _move_image(img_path, err_dir)
        return {
            "route": "errors",
            "reason": reason,
            "moved": bool(dst),
            "dst": dst,
        }

    # 3) OK only if persisted and strategy ok
    if persisted:
        dst = _move_image(img_path, ok_dir)
        return {
            "route": "ok",
            "reason": "persisted_and_strategy_ok",
            "moved": bool(dst),
            "dst": dst,
        }

    # 4) Anything else -> errors
    dst = _move_image(img_path, err_dir)
    return {
        "route": "errors",
        "reason": "not_persisted",
        "moved": bool(dst),
        "dst": dst,
    }


def run_loop(args: Any) -> None:
    cfg = LoopConfig(
        worker_id=int(args.id),
        interval_ms=int(args.interval_ms),
        image_path=getattr(args, "image", None),
        images_dir=getattr(args, "images_dir", None),
        loop_dir=parse_bool(getattr(args, "loop", None)),
        region=getattr(args, "region", None),
        max_ticks=getattr(args, "max_ticks", None),
        print_every_tick=parse_bool(getattr(args, "print_every_tick", None)),
        persist_without_stack=parse_bool(getattr(args, "persist_without_stack", None)),
    )

    mode = select_mode(cfg.image_path, cfg.images_dir)

    # Lazy imports
    from modules.db import db as dbmod
    from modules.ocr.ocr import run_ocr

    try:
        from modules.strategy.substrategy_selector import MatchInput, select_move
    except Exception:
        MatchInput = None  # type: ignore
        select_move = None  # type: ignore

    dir_state = ReplayDirState()
    if mode == "replay_dir" and cfg.images_dir:
        cfg.images_dir = os.path.abspath(cfg.images_dir)
        dir_state.files = list_images_in_dir(cfg.images_dir)

        _ensure_dir(os.path.join(cfg.images_dir, "ok"))
        _ensure_dir(os.path.join(cfg.images_dir, "errors"))
        _ensure_dir(os.path.join(cfg.images_dir, "borrar"))

    last_hand_sig: Optional[str] = None
    tick = 0

    try:
        while True:
            tick += 1
            ts = time.time()

            timing = Timing.empty()
            timing.t_tick0 = time.perf_counter()

            # image
            timing.t_get_image0 = time.perf_counter()
            img = get_image_for_tick(
                mode,
                image_path=cfg.image_path,
                images_dir=cfg.images_dir,
                loop_dir=cfg.loop_dir,
                region=cfg.region,
                dir_state=dir_state,
            )
            timing.t_get_image1 = time.perf_counter()

            if img.done:
                break

            # preflop
            timing.t_preflop0 = time.perf_counter()
            preflop = run_preflop(img.img_path) if img.img_path else {"error": "no image", "preflop_ok": False}
            timing.t_preflop1 = time.perf_counter()

            preflop_ok = bool(preflop.get("preflop_ok", False)) if isinstance(preflop, dict) else False

            # ocr
            timing.t_ocr0 = time.perf_counter()
            ocr: Dict[str, Any] = ensure_ocr_shape()
            if img.img_path:
                try:
                    ocr = run_ocr(img.img_path)
                except Exception as e:
                    ocr = ensure_ocr_shape(err=f"run_ocr:{e}")
            timing.t_ocr1 = time.perf_counter()

            mano_result, stacks_result = extract_preflop_modules(preflop)

            ocr_stacks = ocr.get("stacks", {}) if isinstance(ocr, dict) else {}
            bets_result = ocr.get("bets", {}) if isinstance(ocr, dict) else {}
            stackefectivo_result = ocr.get("stackefectivo", {}) if isinstance(ocr, dict) else {}
            names_result = ocr.get("names", {}) if isinstance(ocr, dict) else {}
            villano_result = ocr.get("villano", {}) if isinstance(ocr, dict) else {}

            fingerprint = get_fingerprint(cfg.worker_id, mode, img.image_ref)

            # dedupe
            p1 = normalize_p1(stacks_result, ocr_stacks)
            can_persist = compute_can_persist(mano_result, p1, cfg.persist_without_stack, preflop_ok)

            sig: Optional[str] = None
            if can_persist:
                sig = compute_sig(mano_result, p1, cfg.persist_without_stack)

            dedupe_skipped, dedupe_reason, last_hand_sig = apply_dedupe(can_persist, sig, last_hand_sig)

            # strategy
            timing.t_strategy0 = time.perf_counter()
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
            timing.t_strategy1 = time.perf_counter()

            # persist
            timing.t_persist0 = time.perf_counter()
            persisted = False
            if (not dedupe_skipped) and can_persist and sig:
                ocr_json = build_ocr_json(
                    mano_result=mano_result,
                    stacks_result=stacks_result,
                    ocr=ocr,
                    preflop=preflop,
                    strategy=strategy,
                    tempo_s=round((time.perf_counter() - timing.t_get_image0), 3),
                )

                frame_ref = ""
                if img.img_path and mode != "screen":
                    frame_ref = os.path.abspath(img.img_path)

                persist_obs(
                    dbmod,
                    sig=sig,
                    ts=ts,
                    mano_result=mano_result,
                    preflop=preflop,
                    ocr_json=ocr_json,
                    bets_result=bets_result,
                    frame_ref=frame_ref,
                )
                persisted = True
            timing.t_persist1 = time.perf_counter()

            tempo_s = round((time.perf_counter() - timing.t_get_image0), 3)

            out = {
                "worker_id": cfg.worker_id,
                "mode": mode,
                "tick": tick,
                "ts": ts,
                "tempo_s": tempo_s,
                "timing_ms": timing.as_ms(),
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
                "errors": img.errors,
                "fingerprint": fingerprint,
                "dedupe_skipped": dedupe_skipped,
                "dedupe_reason": dedupe_reason,
                "image_ref": img.image_ref,
                "persist_without_stack": cfg.persist_without_stack,
            }

            # Routing + DB frame_ref fix
            if mode == "replay_dir" and cfg.images_dir and img.img_path:
                routing = _route_replay_dir_image(
                    img_path=os.path.abspath(img.img_path),
                    images_dir=cfg.images_dir,
                    persisted=persisted,
                    preflop=preflop,
                    strategy=strategy,
                )
                out["replay_dir_routing"] = routing

                # If we persisted and the file was moved, update DB to point to the new path.
                if persisted and sig and routing.get("moved") and routing.get("dst"):
                    updated = _update_db_frame_ref(dbmod, sig, routing["dst"])
                    out["db_frame_ref_updated"] = updated

            if cfg.print_every_tick:
                print(json.dumps(out, ensure_ascii=False))

            if mode == "screen" and img.cleanup_path:
                safe_remove(img.cleanup_path)

            if cfg.max_ticks is not None and tick >= cfg.max_ticks:
                break

            time.sleep(cfg.interval_ms / 1000.0)

    except KeyboardInterrupt:
        print(json.dumps({"worker_id": cfg.worker_id, "event": "shutdown", "ts": time.time()}, ensure_ascii=False))