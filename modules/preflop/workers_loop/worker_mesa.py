from __future__ import annotations

import json
import os
import shutil
import time
from typing import Any, Dict, Optional, TextIO, Tuple

from modules.ocr.ocr import run_ocr
from modules.workers.worker_loop import process_one_image
from modules.workers.worker_loop_types import LoopConfig
from modules.workers.worker_utils import get_file_fingerprint

from .capture import capture_to_tmp
from .fs_utils import log, safe_move
from .preflop_logic import preflop_fail
from .strategy_utils import force_ok_on_default_fold, has_strategy_move
from .time_gate import run_time_gate_for_area
from .worker_mesa_debug import safe_remove, write_no_strategy_debug
from .worker_mesa_preflop import (
    describe_preflop_fail,
    run_preflop_direct,
    write_preflop_fail_debug,
)

RECENT_CAPTURE_WINDOW_MS = int(os.environ.get("POKER_BOSS_CAPTURE_DEDUPE_WINDOW_MS", "3000"))

# Backward-compatible private aliases for tests/monkeypatching.
_run_preflop_direct = run_preflop_direct
_describe_preflop_fail = describe_preflop_fail
_write_preflop_fail_debug = write_preflop_fail_debug
_safe_remove = safe_remove


def _extract_time_mano_candidate(preflop: Any) -> Dict[str, Any]:
    if not isinstance(preflop, dict):
        return {"candidate_ok": False, "mano_ok": False, "time_ok": False, "mano": {}, "time": {}}

    mods = preflop.get("modules", {})
    if not isinstance(mods, dict):
        return {"candidate_ok": False, "mano_ok": False, "time_ok": False, "mano": {}, "time": {}}

    mano = mods.get("mano", {})
    time_mod = mods.get("time", {})

    mano_ok = False
    if isinstance(mano, dict):
        if "mano_ok" in mano:
            mano_ok = bool(mano.get("mano_ok"))
        elif "valid" in mano:
            mano_ok = bool(mano.get("valid"))
        else:
            hand_class = str(mano.get("hand_class", "")).strip()
            mano_raw = str(mano.get("mano_raw", "")).strip()
            mano_ok = bool(hand_class and hand_class != "??" and mano_raw and mano_raw != "UNKNOWNUNKNOWN")

    time_ok = False
    if isinstance(time_mod, dict):
        if "time_ok" in time_mod:
            time_ok = bool(time_mod.get("time_ok"))

    return {
        "candidate_ok": bool(mano_ok and time_ok),
        "mano_ok": bool(mano_ok),
        "time_ok": bool(time_ok),
        "mano": mano if isinstance(mano, dict) else {},
        "time": time_mod if isinstance(time_mod, dict) else {},
    }


def _write_time_mano_candidate(
    *,
    dirs: Any,
    src_img_path: str,
    mesa: int,
    capture_id: Optional[int],
    image_fingerprint: Optional[str],
    preflop: Any,
) -> Optional[str]:
    info = _extract_time_mano_candidate(preflop)
    if not info.get("candidate_ok"):
        return None

    base_dir = os.path.dirname(getattr(dirs, "err_dir"))
    cand_dir = os.path.join(base_dir, "time_mano_candidates")
    os.makedirs(cand_dir, exist_ok=True)

    base_name = os.path.basename(src_img_path)
    dst_img = os.path.join(cand_dir, base_name)
    shutil.copy2(src_img_path, dst_img)

    payload = {
        "mesa": mesa,
        "capture_id": capture_id,
        "image_fingerprint": image_fingerprint,
        "src_img_path": os.path.abspath(src_img_path),
        "candidate_img_path": os.path.abspath(dst_img),
        "preflop_ok": bool(preflop.get("preflop_ok")) if isinstance(preflop, dict) else False,
        "mano_ok": bool(info.get("mano_ok")),
        "time_ok": bool(info.get("time_ok")),
        "mano_raw": info.get("mano", {}).get("mano_raw"),
        "hand_class": info.get("mano", {}).get("hand_class"),
        "score1": info.get("mano", {}).get("score1"),
        "score2": info.get("mano", {}).get("score2"),
        "time_score": info.get("time", {}).get("score"),
        "noboard_ok": (
            bool(((preflop.get("modules") or {}).get("noboard") or {}).get("noboard_ok"))
            if isinstance(preflop, dict) else False
        ),
        "errors": preflop.get("errors", []) if isinstance(preflop, dict) else [],
        "preflop": preflop if isinstance(preflop, dict) else str(preflop),
    }

    with open(dst_img + ".json", "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2, default=str)

    return dst_img


def _update_obs_frame_ref(dbmod: Any, fingerprint: str, new_frame_ref: str) -> bool:
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


def run_worker_mesa_once(
    *,
    area: Dict[str, Any],
    dirs: Any,
    ts: str,
    interval_ms: int,
    verbose: bool,
    fp: TextIO,
    fixed_input: Optional[str],
    last_sig_by_mesa: Dict[int, Optional[str]],
    dbg: bool,
    dbmod: Any,
    MatchInput: Any,
    select_move: Any,
    extract_modules_fn: Any,
    build_ocr_safe_fn: Any,
    compute_strategy_safe_fn: Any,
) -> None:
    mesa = int(area["mesa"])
    last_sig_by_mesa.setdefault(mesa, None)

    if fixed_input:
        try:
            img_path = os.path.join(dirs.tmp_dir, f"{ts}__mesa_{mesa}.bmp")
            shutil.copy2(fixed_input, img_path)
        except Exception as e:
            log(fp, f"[mesa {mesa}] CAPTURE ERROR: {e}")
            return
    else:
        time_gate = run_time_gate_for_area(area, dirs.tmp_dir, ts)
        if not bool(time_gate.get("time_ok")):
            if dbg:
                score = time_gate.get("score", None)
                reason = time_gate.get("error") or time_gate.get("reason") or "time_false"
                log(fp, f"[mesa {mesa}] TIME FALSE -> skip | score={score!r} | reason={reason}")
            return

        try:
            img_path = capture_to_tmp(area, dirs.tmp_dir, ts)
        except Exception as e:
            log(fp, f"[mesa {mesa}] CAPTURE ERROR: {e}")
            return

    capture_id: Optional[int] = None
    image_fp: Optional[str] = None
    ocr: Dict[str, Any] = {}

    try:
        image_fp = get_file_fingerprint(img_path)
        image_size_bytes = os.path.getsize(img_path)
        since_ms = int(time.time() * 1000) - RECENT_CAPTURE_WINDOW_MS

        recent = dbmod.find_recent_capture_by_fingerprint(
            image_fingerprint=image_fp,
            since_ms=since_ms,
        )

        if recent:
            _safe_remove(img_path)
            if dbg or verbose:
                log(
                    fp,
                    f"[mesa {mesa}] DUPLICATE CAPTURE -> skip | fp={image_fp} | prev_capture_id={recent.get('capture_id')} | prev_status={recent.get('status')} | window_ms={RECENT_CAPTURE_WINDOW_MS}",
                )
            return

        capture_id = dbmod.insert_worker_capture(
            mesa=mesa,
            image_path=os.path.abspath(img_path),
            image_fingerprint=image_fp,
            image_size_bytes=image_size_bytes,
            status="captured",
            reason="time_gate_passed",
        )

        ocr = run_ocr(img_path)
        if capture_id is not None:
            dbmod.update_worker_capture_ocr(
                capture_id=capture_id,
                ocr_ok=bool((ocr or {}).get("ok")),
                ocr_json=json.dumps(ocr or {}, ensure_ascii=False),
            )
    except Exception as e:
        _safe_remove(img_path)
        log(fp, f"[mesa {mesa}] CAPTURE/OCR ERROR: {e}")
        return

    try:
        preflop: Dict[str, Any] = _run_preflop_direct(img_path)
    except Exception as e:
        preflop = {"preflop_ok": False, "error": f"run_preflop_direct:{e}"}

    candidate_dst = None
    try:
        candidate_dst = _write_time_mano_candidate(
            dirs=dirs,
            src_img_path=img_path,
            mesa=mesa,
            capture_id=capture_id,
            image_fingerprint=image_fp,
            preflop=preflop,
        )
        if candidate_dst and (dbg or verbose):
            log(fp, f"[mesa {mesa}] TIME+MANO CANDIDATE -> saved: {candidate_dst}")
    except Exception as e:
        log(fp, f"[mesa {mesa}] TIME+MANO CANDIDATE save error: {e}")

    if preflop_fail(preflop):
        dst = safe_move(img_path, dirs.del_dir)
        reason_text = _describe_preflop_fail(preflop)

        log(fp, f"[mesa {mesa}] preflop FAIL -> borrar: {dst} | {reason_text}")

        try:
            _write_preflop_fail_debug(dst, mesa, preflop)
        except Exception as e:
            log(fp, f"[mesa {mesa}] preflop FAIL debug write error: {e}")

        if capture_id is not None:
            try:
                dbmod.update_worker_capture_route(
                    capture_id=capture_id,
                    final_image_path=dst,
                    status="borrar",
                    reason=reason_text,
                )
            except Exception:
                pass

        return

    mano_result, stacks_result = extract_modules_fn(preflop)

    strategy, err = compute_strategy_safe_fn(preflop, mano_result, ocr)
    strategy = force_ok_on_default_fold(strategy)

    cfg = LoopConfig(
        worker_id=mesa,
        interval_ms=int(interval_ms),
        image_path=None,
        images_dir=None,
        loop_dir=False,
        region=None,
        max_ticks=None,
        print_every_tick=False,
        persist_without_stack=False,
    )

    def _rp(_p: str) -> Any:
        return preflop

    def _em(_pf: Any) -> Tuple[Dict[str, Any], Dict[str, Any]]:
        return (mano_result, stacks_result)

    def _run_ocr_fn(_p: str) -> Dict[str, Any]:
        return ocr

    def _cs(**_kw: Any) -> Dict[str, Any]:
        return strategy

    out, new_sig = process_one_image(
        cfg=cfg,
        mode="screen",
        img_path=img_path,
        image_ref=img_path,
        dbmod=dbmod,
        run_ocr_fn=_run_ocr_fn,
        MatchInput=MatchInput,
        select_move=select_move,
        last_hand_sig=last_sig_by_mesa[mesa],
        run_preflop_fn=_rp,
        extract_modules_fn=_em,
        compute_strategy_fn=_cs,
    )
    last_sig_by_mesa[mesa] = new_sig

    if has_strategy_move(strategy):
        dst = safe_move(img_path, dirs.ok_dir)
        if verbose:
            log(fp, f"[mesa {mesa}] OK -> ok: {dst}")

        if capture_id is not None:
            try:
                dbmod.update_worker_capture_route(
                    capture_id=capture_id,
                    final_image_path=dst,
                    status="ok",
                    reason="strategy_has_move_and_bets",
                )
            except Exception:
                pass

        if out.get("persisted") and new_sig and dst:
            try:
                _update_obs_frame_ref(dbmod, new_sig, dst)
            except Exception:
                pass
    else:
        dst = safe_move(img_path, dirs.err_dir)
        reason = None
        if isinstance(strategy, dict):
            reason = strategy.get("error") or strategy.get("reason")
        reason_text = str(reason or err or "no_move/bets")

        if verbose:
            log(fp, f"[mesa {mesa}] NO STRATEGY -> errors: {dst} | reason={reason_text}")

        if capture_id is not None:
            try:
                dbmod.update_worker_capture_route(
                    capture_id=capture_id,
                    final_image_path=dst,
                    status="errors",
                    reason=reason_text,
                )
            except Exception:
                pass

        if out.get("persisted") and new_sig and dst:
            try:
                _update_obs_frame_ref(dbmod, new_sig, dst)
            except Exception:
                pass

        if dbg:
            try:
                write_no_strategy_debug(
                    dst=dst,
                    mesa=mesa,
                    preflop=preflop,
                    strategy=strategy,
                    ocr=ocr,
                    out=out,
                    image_fingerprint=image_fp,
                    capture_id=capture_id,
                )
            except Exception:
                pass





