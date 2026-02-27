# C:\Users\Usuario\Desktop\proyectos\poker_boss\modules\workers\worker_loop.py
from __future__ import annotations

import os
import time
import json
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
            can_persist = compute_can_persist(mano_result, p1, cfg.persist_without_stack)

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

            if cfg.print_every_tick:
                print(json.dumps(out, ensure_ascii=False))

            if mode == "screen" and img.cleanup_path:
                safe_remove(img.cleanup_path)

            if cfg.max_ticks is not None and tick >= cfg.max_ticks:
                break

            time.sleep(cfg.interval_ms / 1000.0)

    except KeyboardInterrupt:
        print(json.dumps({"worker_id": cfg.worker_id, "event": "shutdown", "ts": time.time()}, ensure_ascii=False))
