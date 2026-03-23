from __future__ import annotations

import json
import logging
import os
import shutil
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Dict, Optional, TextIO, Tuple

from PIL import Image

from modules.ocr.ocr import run_ocr
from modules.workers.worker_utils import get_file_fingerprint

from .config import CAPTURES_IMG_DIR
from .capture import capture_to_tmp
from .fs_utils import log, safe_move
from .preflop_logic import preflop_fail
from .strategy_utils import force_ok_on_default_fold, has_strategy_move
from .mesa_config import build_time_bbox
from .time_gate import run_time_gate_on_roi_path
from .worker_mesa_candidates import write_time_mano_candidate
from .worker_mesa_debug import safe_remove, write_no_strategy_debug
from .worker_mesa_obs import persist_preflop_obs, update_obs_frame_ref
from .worker_mesa_preflop import (
    describe_preflop_fail,
    run_preflop_direct,
    write_preflop_fail_debug,
)
from ..fingerprinting import spot_fingerprint

RECENT_CAPTURE_WINDOW_MS = int(os.environ.get("POKER_BOSS_CAPTURE_DEDUPE_WINDOW_MS", "15000"))


def _update_mesa_time_active(mesa: int, active: bool) -> None:
    """Update mesa_state.time_active so the overlay knows when to hide pills."""
    from modules.db.conn import connect
    now_ms = int(time.time() * 1000)
    with connect() as conn:
        conn.execute(
            """
            INSERT INTO mesa_state (mesa, time_active, updated_at_ms)
            VALUES (?, ?, ?)
            ON CONFLICT(mesa) DO UPDATE SET time_active = excluded.time_active, updated_at_ms = excluded.updated_at_ms
            """,
            (int(mesa), 1 if active else 0, now_ms),
        )
        conn.commit()

# Cache en memoria por mesa para cortar frames idénticos antes del pipeline pesado.
_LAST_CAPTURE_FP_BY_MESA: Dict[int, Optional[str]] = {}

_run_preflop_direct = run_preflop_direct
_describe_preflop_fail = describe_preflop_fail
_write_preflop_fail_debug = write_preflop_fail_debug
_safe_remove = safe_remove


def _build_spot_fingerprint(
    *,
    mesa: int,
    ts: str,
    stacks_result: Optional[Dict[str, Any]],
    ocr: Optional[Dict[str, Any]],
) -> str:
    """Fingerprint lógico basado en mesa + P1 stack para deduplicar spots."""
    try:
        p1_stack: Optional[float] = None
        if isinstance(stacks_result, dict):
            p1_stack = stacks_result.get("p1")
        if p1_stack is None and isinstance(ocr, dict):
            stacks = ocr.get("stacks")
            if isinstance(stacks, dict):
                p1_stack = stacks.get("p1")

        if p1_stack is None:
            return ""

        # Use centralized fingerprinting (see modules/preflop/fingerprinting.py)
        return spot_fingerprint(mesa=int(mesa), p1_stack=float(p1_stack))
    except Exception:
        logging.exception(f"Failed to build spot fingerprint for mesa={mesa}")
        return ""


def run_worker_mesa_once(
    *,
    area: Dict[str, Any],  # Required: {"mesa": int, "x1": int, "y1": int, "x2": int, "y2": int}
    dirs: Any,  # LoopDirs with: tmp_dir, ok_dir, err_dir, del_dir
    ts: str,  # Timestamp string (format: YYYY-MM-DD HH:MM:SS or similar)
    interval_ms: int,  # Sleep interval between captures in milliseconds
    verbose: bool,
    fp: TextIO,  # File pointer for logging
    fixed_input: Optional[str],  # Optional fixed image path for testing
    last_sig_by_mesa: Dict[int, Optional[str]],  # Cache of last frame fingerprint per mesa
    dbg: bool,
    dbmod: Any,  # Database module with ORM-like methods
    MatchInput: Any,  # Type for matching inputs
    select_move: Any,  # Function to select move
    extract_modules_fn: Any,  # Function to extract preflop modules
    build_ocr_safe_fn: Any,  # Function to build OCR safely
    compute_strategy_safe_fn: Any,  # Function to compute strategy safely
) -> None:
    # Validate required area fields
    try:
        mesa = int(area["mesa"])
        if mesa <= 0:
            log(fp, f"ERROR: Invalid mesa number: {mesa}")
            return
    except (KeyError, ValueError, TypeError) as e:
        log(fp, f"ERROR: Invalid area structure: {e}")
        return
    last_sig_by_mesa.setdefault(mesa, None)
    _LAST_CAPTURE_FP_BY_MESA.setdefault(mesa, None)

    spot_id: Optional[int] = None

    tick_t0 = time.perf_counter()
    time_spot_t0: Optional[float] = None

    profile_enabled = os.environ.get("POKER_BOSS_WORKER_PROFILE", "0") == "1"
    profile_times: Dict[str, float] = {}

    if fixed_input:
        try:
            img_path = os.path.join(dirs.tmp_dir, f"{ts}__mesa_{mesa}.bmp")
            shutil.copy2(fixed_input, img_path)
        except Exception as e:
            log(fp, f"[mesa {mesa}] CAPTURE ERROR: {e}")
            return
    else:
        t_capture0 = time.perf_counter() if profile_enabled else 0.0
        try:
            img_path = capture_to_tmp(area, dirs.tmp_dir, ts)
        except Exception as e:
            log(fp, f"[mesa {mesa}] CAPTURE ERROR: {e}")
            return
        if profile_enabled:
            profile_times["capture"] = time.perf_counter() - t_capture0
        time_bbox = build_time_bbox(area)
        roi_path = os.path.join(dirs.tmp_dir, f"{ts}__mesa_{mesa}__time_roi.bmp")
        try:
            with Image.open(img_path) as img:
                # Captured image is only the area (origin 0,0); time_bbox is in screen coords -> convert to image-relative
                ax1, ay1 = int(area["x1"]), int(area["y1"])
                roi_in_image = (time_bbox[0] - ax1, time_bbox[1] - ay1, time_bbox[2] - ax1, time_bbox[3] - ay1)
                crop = img.crop(roi_in_image)
                crop.save(roi_path, format="BMP")
        except Exception as e:
            _safe_remove(img_path)
            log(fp, f"[mesa {mesa}] TIME ROI CROP ERROR: {e}")
            return
        t_time_gate0 = time.perf_counter() if profile_enabled else 0.0
        time_gate = run_time_gate_on_roi_path(area, dirs.tmp_dir, ts, roi_path)
        if profile_enabled:
            profile_times["time_gate"] = time.perf_counter() - t_time_gate0
        if not bool(time_gate.get("time_ok")):
            _safe_remove(img_path)
            # Mark mesa as time_active=0 so overlay hides strategy pills
            try:
                _update_mesa_time_active(mesa, False)
            except Exception:
                pass
            if dbg:
                score = time_gate.get("score", None)
                reason = time_gate.get("error") or time_gate.get("reason") or "time_false"
                log(fp, f"[mesa {mesa}] TIME FALSE -> skip | score={score!r} | reason={reason}")
            return
        # Mark mesa as time_active=1
        try:
            _update_mesa_time_active(mesa, True)
        except Exception:
            pass
        time_spot_t0 = time.perf_counter()

    capture_id: Optional[int] = None
    image_fp: Optional[str] = None
    ocr: Dict[str, Any] = {}
    obs_id: Optional[int] = None

    try:
        t_fpdb0 = time.perf_counter() if profile_enabled else 0.0
        image_fp = get_file_fingerprint(img_path)
        image_size_bytes = os.path.getsize(img_path)

        last_capture_fp = _LAST_CAPTURE_FP_BY_MESA.get(mesa)
        if last_capture_fp == image_fp:
            _safe_remove(img_path)
            if dbg or verbose:
                log(fp, f"[mesa {mesa}] UNCHANGED_FRAME -> skip | fp={image_fp}")
            return

        _LAST_CAPTURE_FP_BY_MESA[mesa] = image_fp

        # DB-level dedup via spots.fingerprint UNIQUE constraint
        existing = dbmod.get_obs_by_fingerprint(image_fp)
        if existing:
            _safe_remove(img_path)
            if dbg or verbose:
                log(fp, f"[mesa {mesa}] DUPLICATE CAPTURE (spots) -> skip | fp={image_fp}")
            return

        capture_id = None
        if profile_enabled:
            profile_times["fp_db"] = time.perf_counter() - t_fpdb0

        ocr: Dict[str, Any] = {}
        preflop: Dict[str, Any] = {}
        # Sequential (default): POKER_BOSS_WORKER_SEQUENTIAL=1. Thread parallelism can increase
        # wall time due to Python GIL on CPU-bound work; sequential is recommended for lower latency.
        _use_parallel = os.environ.get("POKER_BOSS_WORKER_SEQUENTIAL", "1") != "1"
        if _use_parallel:
            t_ocrpre0 = time.perf_counter() if profile_enabled else 0.0
            with ThreadPoolExecutor(max_workers=2) as executor:
                fut_ocr = executor.submit(run_ocr, img_path)
                fut_preflop = executor.submit(_run_preflop_direct, img_path)
                try:
                    ocr = fut_ocr.result()
                except Exception as e:
                    ocr = {"ok": False, "errors": [str(e)]}
                try:
                    preflop = fut_preflop.result()
                except Exception as e:
                    preflop = {"preflop_ok": False, "error": f"run_preflop_direct:{e}"}
            if profile_enabled:
                profile_times["ocr_preflop_parallel"] = time.perf_counter() - t_ocrpre0
        else:
            t_ocr0 = time.perf_counter() if profile_enabled else 0.0
            try:
                ocr = run_ocr(img_path)
            except Exception as e:
                ocr = {"ok": False, "errors": [str(e)]}
            if profile_enabled:
                profile_times["ocr"] = time.perf_counter() - t_ocr0
                timings = (ocr or {}).get("_timings") or {}
                for key in [
                    "ocr_preprocess",
                    "ocr_table_state",
                    "ocr_posiciones",
                    "ocr_bets",
                    "ocr_stacks",
                    "ocr_names",
                    "ocr_dealer",
                    # ocr_gamecode se deja como métrica opcional; ahora mismo no se mide.
                    "ocr_gamecode",
                    "ocr_total_internal",
                ]:
                    if key in timings:
                        profile_times[key] = float(timings[key])
            t_pre0 = time.perf_counter() if profile_enabled else 0.0
            try:
                preflop = _run_preflop_direct(img_path)
            except Exception as e:
                preflop = {"preflop_ok": False, "error": f"run_preflop_direct:{e}"}
            if profile_enabled:
                profile_times["preflop"] = time.perf_counter() - t_pre0

        def _deferred_candidate() -> None:
            try:
                write_time_mano_candidate(
                    dirs=dirs,
                    src_img_path=img_path,
                    mesa=mesa,
                    capture_id=capture_id,
                    image_fingerprint=image_fp,
                    preflop=preflop,
                )
            except Exception:
                logging.exception(f"[mesa {mesa}] write_time_mano_candidate failed")

        t = threading.Thread(target=_deferred_candidate, daemon=False)
        t.start()
    except Exception as e:
        _safe_remove(img_path)
        log(fp, f"[mesa {mesa}] CAPTURE/OCR ERROR: {e}")
        return

    if preflop_fail(preflop):
        dst = safe_move(img_path, dirs.del_dir)
        reason_text = _describe_preflop_fail(preflop)

        log(fp, f"[mesa {mesa}] preflop FAIL -> borrar: {dst} | {reason_text}")

        try:
            _write_preflop_fail_debug(dst, mesa, preflop)
        except Exception as e:
            log(fp, f"[mesa {mesa}] preflop FAIL debug write error: {e}")

        return

    # Spot preflop confirmado: guardar captura en data/img.
    dest_capture_path = img_path
    t_copy0 = time.perf_counter() if profile_enabled else 0.0
    try:
        os.makedirs(CAPTURES_IMG_DIR, exist_ok=True)
        base_name = os.path.basename(img_path)
        dest_capture_path = os.path.join(CAPTURES_IMG_DIR, base_name)
        shutil.copy2(img_path, dest_capture_path)
        if dbg or verbose:
            log(fp, f"[mesa {mesa}] PREFLOP CAPTURE -> {dest_capture_path}")
    except Exception as e:
        log(fp, f"[mesa {mesa}] PREFLOP CAPTURE save error: {e}")
    if profile_enabled:
        profile_times["copy_capture"] = time.perf_counter() - t_copy0

    t_extract0 = time.perf_counter() if profile_enabled else 0.0
    mano_result, stacks_result = extract_modules_fn(preflop)
    if profile_enabled:
        profile_times["extract"] = time.perf_counter() - t_extract0

    time_sec = (time.perf_counter() - time_spot_t0) if time_spot_t0 is not None else None

    # Override preflop_ok: the worker loop already verified time gate before
    # reaching this point, so we trust mano+noboard only (not time inside preflop).
    if isinstance(preflop, dict) and not preflop.get("preflop_ok"):
        preflop = {**preflop, "preflop_ok": True}

    t_strategy0 = time.perf_counter() if profile_enabled else 0.0
    strategy, err = compute_strategy_safe_fn(preflop, mano_result, ocr)
    strategy = force_ok_on_default_fold(strategy)
    if profile_enabled:
        profile_times["strategy"] = time.perf_counter() - t_strategy0

    # Enrich strategy with spot_strategy_id (for ocr_json persistence in spots table)
    if isinstance(strategy, dict):
        try:
            sheet = str(strategy.get("sheet") or "").strip().lower()
            if sheet != "nash push fold":
                se_used = strategy.get("se_used", None)
                hero_pos = str((strategy.get("spot") or "")).strip()
                if not hero_pos:
                    situacion = str(strategy.get("situacion") or "")
                    hero_pos = (situacion.split("_vs_", 1)[0] if "_vs_" in situacion else "").strip()

                if se_used is not None and hero_pos:
                    from modules.db.db import get_conn
                    from modules.strategy.spots_strategies_repo import (
                        SpotStrategyMatchInput,
                        find_unique_spot_strategy_id,
                    )

                    situacion = str(strategy.get("situacion") or "")
                    rest = situacion.split("_vs_", 1)[1] if "_vs_" in situacion else ""
                    parts = rest.split("_") if rest else []
                    p2_pos = parts[0] if len(parts) >= 1 else ""
                    p3_pos = parts[1] if len(parts) >= 2 else ""
                    p2_tipo = parts[2] if len(parts) >= 3 else ""
                    p3_tipo = parts[3] if len(parts) >= 4 else ""

                    hand_class = ""
                    if isinstance(mano_result, dict):
                        hand_class = str(mano_result.get("hand_class") or "").strip()

                    inp = SpotStrategyMatchInput(
                        spot_key=hero_pos,
                        hand_class=hand_class,
                        p1_se_bb=float(se_used),
                        p1_bet_bb=float(strategy.get("bets_p1_used") or 0.0),
                        p2_pos=p2_pos,
                        p3_pos=p3_pos,
                        p2_tipo=p2_tipo,
                        p3_tipo=p3_tipo,
                    )
                    conn = get_conn()
                    try:
                        sid = find_unique_spot_strategy_id(conn, inp)
                    finally:
                        conn.close()
                    if sid is not None:
                        strategy["spot_strategy_id"] = int(sid)
                    else:
                        strategy.pop("spot_strategy_id", None)
        except Exception as e:
            strategy["spot_strategy_link_error"] = str(e)

    t_obs0 = time.perf_counter() if profile_enabled else 0.0
    try:
        obs_id = persist_preflop_obs(
            dbmod=dbmod,
            preflop=preflop,
            image_fp=image_fp,
            img_path=img_path,
            mesa=mesa,
            ocr=ocr,
            mano_result=mano_result,
            stacks_result=stacks_result,
            strategy=strategy,
            tempo_s=round(time.perf_counter() - tick_t0, 3),
        )
        if obs_id and (dbg or verbose):
            log(fp, f"[mesa {mesa}] spots persisted -> spot_id={obs_id} | fp={image_fp}")
    except Exception as e:
        log(fp, f"[mesa {mesa}] spots persist error: {e}")
    if profile_enabled:
        profile_times["obs"] = time.perf_counter() - t_obs0

    if profile_enabled:
        total = time.perf_counter() - tick_t0
        profile_times["total"] = total
        profile_times["time_sec"] = time_sec or 0.0
        parts_keys = [
            "time_gate",
            "capture",
            "fp_db",
            "ocr",
            "preflop",
            "ocr_preflop_parallel",
            "copy_capture",
            "extract",
            "insert_spot",
            "strategy",
            "obs",
            "time_sec",
            "total",
            "ocr_preprocess",
            "ocr_table_state",
            "ocr_posiciones",
            "ocr_bets",
            "ocr_stacks",
            "ocr_names",
            "ocr_dealer",
            "ocr_gamecode",
            "ocr_total_internal",
        ]
        parts = " ".join(f"{k}={profile_times.get(k, 0.0):.4f}" for k in parts_keys)
        cur_spot_id = spot_id if "spot_id" in locals() else None
        log(fp, f"[mesa {mesa}] PROFILE ts={ts} capture_id={capture_id} spot_id={cur_spot_id} {parts}")


    last_sig_by_mesa[mesa] = image_fp

    if has_strategy_move(strategy):
        dst = safe_move(img_path, dirs.ok_dir)
        if verbose:
            log(fp, f"[mesa {mesa}] OK -> ok: {dst}")

        if image_fp and dst:
            try:
                update_obs_frame_ref(dbmod, image_fp, dst)
            except Exception:
                logging.exception(f"[mesa {mesa}] update_obs_frame_ref (fp) failed")

    else:
        dst = safe_move(img_path, dirs.err_dir)
        reason = None
        if isinstance(strategy, dict):
            reason = strategy.get("error") or strategy.get("reason")
        reason_text = str(reason or err or "no_move/bets")

        if verbose:
            log(fp, f"[mesa {mesa}] NO STRATEGY -> errors: {dst} | reason={reason_text}")

        if image_fp and dst:
            try:
                update_obs_frame_ref(dbmod, image_fp, dst)
            except Exception:
                logging.exception(f"[mesa {mesa}] update_obs_frame_ref (fp, errors path) failed")

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
                logging.debug(f"[mesa {mesa}] write_no_strategy_debug failed", exc_info=True)
