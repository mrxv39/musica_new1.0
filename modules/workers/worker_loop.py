# C:\Users\Usuario\Desktop\proyectos\poker_boss\modules\workers\worker_loop.py
from __future__ import annotations

import os
import time
import json
import shutil
from typing import Any, Dict, Optional, Callable, Tuple

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


NO_OK_DIR_NAME = "no ok"


def _is_preflop_fail(preflop: Any) -> bool:
    """
    True if preflop failed due to:
      - no cards (mano.valid == False OR mano.mano_ok == False)
      - noboard == false (noboard_ok == False)
    If structure is missing/unknown, we treat as fail to keep dataset clean.
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


def _has_strategy_move(strategy: Any) -> bool:
    """
    OK cuando strategy.ok == True y existen move, betmin, betmax.
    """
    if not isinstance(strategy, dict):
        return False
    if strategy.get("ok") is not True:
        return False

    move = strategy.get("move", None)
    betmin = strategy.get("betmin", None)
    betmax = strategy.get("betmax", None)

    if move is None or str(move).strip() == "":
        return False
    if betmin is None or betmax is None:
        return False

    return True


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
    Reglas EXACTAS (prioridad):
      1) Si preflop falla -> mover a borrar/
      2) Si NO hay estrategia (no hay move/betmin/betmax) -> mover a errors/
      3) Si hay move + betmin + betmax -> mover a ok/

    Nota: persisted NO decide la ruta; sólo sirve para actualizar frame_ref en DB si se movió.
    """
    ok_dir = os.path.join(images_dir, "ok")
    err_dir = os.path.join(images_dir, NO_OK_DIR_NAME)
    del_dir = os.path.join(images_dir, NO_OK_DIR_NAME)

    # 1) Preflop fail -> borrar/
    if _is_preflop_fail(preflop):
        dst = _move_image(img_path, del_dir)
        return {
            "route": "borrar",
            "reason": "preflop_failed_move_to_borrar",
            "moved": bool(dst),
            "dst": dst,
        }

    # 2) Sin estrategia -> errors/
    if not _has_strategy_move(strategy):
        reason = "no_strategy_or_missing_move_bets"
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

    # 3) OK -> ok/
    dst = _move_image(img_path, ok_dir)
    return {
        "route": "ok",
        "reason": "strategy_has_move_and_bets",
        "moved": bool(dst),
        "dst": dst,
    }


# --------------------------------------------------------------------------------------
# Reusable pipeline for ONE image (used by external loops)
# --------------------------------------------------------------------------------------

RunPreflopFn = Callable[[str], Any]
RunOcrFn = Callable[[str], Dict[str, Any]]
ExtractModulesFn = Callable[[Any], Tuple[Dict[str, Any], Dict[str, Any]]]
ComputeStrategyFn = Callable[..., Dict[str, Any]]


def process_one_image(
    *,
    cfg: LoopConfig,
    mode: str,
    img_path: Optional[str],
    image_ref: str,
    dbmod: Any,
    run_ocr_fn: RunOcrFn,
    MatchInput: Any,
    select_move: Any,
    last_hand_sig: Optional[str],
    persist_to_db: bool = True,
    # injectables for tests / alternate loops
    run_preflop_fn: Optional[RunPreflopFn] = None,
    extract_modules_fn: Optional[ExtractModulesFn] = None,
    compute_strategy_fn: Optional[ComputeStrategyFn] = None,
) -> Tuple[Dict[str, Any], Optional[str]]:
    """
    Same pipeline as run_loop for a single image:
      preflop -> ocr -> dedupe -> strategy -> persist -> (optional replay_dir routing)
    Returns: (out_dict, updated_last_hand_sig)
    """
    ts = time.time()

    timing = Timing.empty()
    timing.t_tick0 = time.perf_counter()

    rp = run_preflop_fn or run_preflop
    em = extract_modules_fn or extract_preflop_modules
    cs = compute_strategy_fn or compute_strategy

    # preflop
    timing.t_preflop0 = time.perf_counter()
    preflop = rp(img_path) if img_path else {"error": "no image", "preflop_ok": False}
    timing.t_preflop1 = time.perf_counter()

    preflop_ok = bool(preflop.get("preflop_ok", False)) if isinstance(preflop, dict) else False

    # ocr
    timing.t_ocr0 = time.perf_counter()
    ocr: Dict[str, Any] = ensure_ocr_shape()
    if img_path:
        try:
            ocr = run_ocr_fn(img_path)
        except Exception as e:
            ocr = ensure_ocr_shape(err=f"run_ocr:{e}")
    timing.t_ocr1 = time.perf_counter()

    mano_result, stacks_result = em(preflop)

    ocr_stacks = ocr.get("stacks", {}) if isinstance(ocr, dict) else {}
    bets_result = ocr.get("bets", {}) if isinstance(ocr, dict) else {}
    stackefectivo_result = ocr.get("stackefectivo", {}) if isinstance(ocr, dict) else {}
    names_result = ocr.get("names", {}) if isinstance(ocr, dict) else {}
    villano_result = ocr.get("villano", {}) if isinstance(ocr, dict) else {}
    gamecode_result = ocr.get("gamecode", {}) if isinstance(ocr, dict) else {}

    fingerprint = get_fingerprint(cfg.worker_id, mode, image_ref)

    # dedupe
    p1 = normalize_p1(stacks_result, ocr_stacks)
    can_persist = compute_can_persist(mano_result, p1, cfg.persist_without_stack, preflop_ok)

    sig: Optional[str] = None
    if can_persist:
        sig = compute_sig(mano_result, p1, cfg.persist_without_stack)

    dedupe_skipped, dedupe_reason, last_hand_sig = apply_dedupe(can_persist, sig, last_hand_sig)

    # strategy
    timing.t_strategy0 = time.perf_counter()
    strategy = cs(
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
    if persist_to_db and (not dedupe_skipped) and can_persist and sig:
        ocr_json = build_ocr_json(
            mano_result=mano_result,
            stacks_result=stacks_result,
            ocr=ocr,
            preflop=preflop,
            strategy=strategy,
            tempo_s=round((time.perf_counter() - timing.t_tick0), 3),
        )

        frame_ref = ""
        if img_path:
            frame_ref = os.path.abspath(img_path)

        persist_obs(
            dbmod,
            sig=sig,
            ts=ts,
            mano_result=mano_result,
            preflop=preflop,
            strategy=strategy,
            ocr_json=ocr_json,
            bets_result=bets_result,
            gamecode_result=gamecode_result,
            frame_ref=frame_ref,
        )
        persisted = True
    timing.t_persist1 = time.perf_counter()

    tempo_s = round((time.perf_counter() - timing.t_tick0), 3)

    out: Dict[str, Any] = {
        "worker_id": cfg.worker_id,
        "mode": mode,
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
        "gamecode_result": gamecode_result,
        "errors": [],
        "fingerprint": fingerprint,
        "dedupe_skipped": dedupe_skipped,
        "dedupe_reason": dedupe_reason,
        "image_ref": image_ref,
        "persist_without_stack": cfg.persist_without_stack,
    }

    # Routing + DB frame_ref fix (only replay_dir)
    if mode == "replay_dir" and cfg.images_dir and img_path:
        routing = _route_replay_dir_image(
            img_path=os.path.abspath(img_path),
            images_dir=cfg.images_dir,
            persisted=persisted,
            preflop=preflop,
            strategy=strategy,
        )
        out["replay_dir_routing"] = routing

        if persisted and sig and routing.get("moved") and routing.get("dst"):
            updated = _update_db_frame_ref(dbmod, sig, routing["dst"])
            out["db_frame_ref_updated"] = updated

    return out, last_hand_sig


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

    MatchInput = None
    select_move = None

    dir_state = ReplayDirState()
    if mode == "replay_dir" and cfg.images_dir:
        cfg.images_dir = os.path.abspath(cfg.images_dir)
        dir_state.files = list_images_in_dir(cfg.images_dir)

        _ensure_dir(os.path.join(cfg.images_dir, "ok"))
        _ensure_dir(os.path.join(cfg.images_dir, NO_OK_DIR_NAME))

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

            out, last_hand_sig = process_one_image(
                cfg=cfg,
                mode=mode,
                img_path=img.img_path,
                image_ref=img.image_ref,
                dbmod=dbmod,
                run_ocr_fn=run_ocr,
                MatchInput=MatchInput,
                select_move=select_move,
                last_hand_sig=last_hand_sig,
            )

            # add non-core fields
            out["tick"] = tick
            out["ts"] = ts
            out["errors"] = img.errors

            if cfg.print_every_tick:
                print(json.dumps(out, ensure_ascii=False))

            if mode == "screen" and img.cleanup_path:
                safe_remove(img.cleanup_path)

            if cfg.max_ticks is not None and tick >= cfg.max_ticks:
                break

            time.sleep(cfg.interval_ms / 1000.0)

    except KeyboardInterrupt:
        print(json.dumps({"worker_id": cfg.worker_id, "event": "shutdown", "ts": time.time()}, ensure_ascii=False))

