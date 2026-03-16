from __future__ import annotations

import json
import os
import shutil
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Dict, Optional, TextIO, Tuple

from PIL import Image

from modules.ocr.ocr import run_ocr
from modules.workers.worker_loop import process_one_image
from modules.workers.worker_loop_types import LoopConfig
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

RECENT_CAPTURE_WINDOW_MS = int(os.environ.get("POKER_BOSS_CAPTURE_DEDUPE_WINDOW_MS", "15000"))

# Cache en memoria por mesa para cortar frames idénticos antes del pipeline pesado.
_LAST_CAPTURE_FP_BY_MESA: Dict[int, Optional[str]] = {}

_run_preflop_direct = run_preflop_direct
_describe_preflop_fail = describe_preflop_fail
_write_preflop_fail_debug = write_preflop_fail_debug
_safe_remove = safe_remove


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
    _LAST_CAPTURE_FP_BY_MESA.setdefault(mesa, None)

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
            if dbg:
                score = time_gate.get("score", None)
                reason = time_gate.get("error") or time_gate.get("reason") or "time_false"
                log(fp, f"[mesa {mesa}] TIME FALSE -> skip | score={score!r} | reason={reason}")
            return
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

        def _deferred_ocr_and_candidate() -> None:
            try:
                if capture_id is not None:
                    dbmod.update_worker_capture_ocr(
                        capture_id=capture_id,
                        ocr_ok=bool((ocr or {}).get("ok")),
                        ocr_json=json.dumps(ocr or {}, ensure_ascii=False),
                    )
            except Exception:
                pass
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
                pass

        t = threading.Thread(target=_deferred_ocr_and_candidate, daemon=True)
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

    # Introducir todos los datos en la tabla spots.
    t_insert_spot0 = time.perf_counter() if profile_enabled else 0.0
    try:
        # #region agent log
        try:
            import json as _json, time as _time

            with open("debug-65a7d6.log", "a", encoding="utf-8") as _f:
                _f.write(
                    _json.dumps(
                        {
                            "sessionId": "65a7d6",
                            "runId": "pre-fix",
                            "hypothesisId": "H3",
                            "location": "worker_mesa.run_worker_mesa_once:before_insert_spot",
                            "message": "About to insert spot",
                            "data": {
                                "mesa": mesa,
                                "ts": ts,
                                "image_fp": image_fp,
                            },
                            "timestamp": int(_time.time() * 1000),
                        }
                    )
                    + "\n"
                )
        except Exception:
            pass
        # #endregion agent log
        spot_id = dbmod.insert_spot_capture_from_data(
            mesa=mesa,
            image_path=dest_capture_path,
            ts=ts,
            stacks_result=stacks_result,
            ocr=ocr,
            preflop=preflop,
            mano_result=mano_result,
            time_sec=time_sec,
            spot_fingerprint=image_fp or "",
        )
        if spot_id and (dbg or verbose):
            log(fp, f"[mesa {mesa}] spots persisted -> id={spot_id}")
    except Exception as e:
        log(fp, f"[mesa {mesa}] spots persist error: {e}")

    if profile_enabled:
        profile_times["insert_spot"] = time.perf_counter() - t_insert_spot0

    t_strategy0 = time.perf_counter() if profile_enabled else 0.0
    strategy, err = compute_strategy_safe_fn(preflop, mano_result, ocr)
    strategy = force_ok_on_default_fold(strategy)
    if profile_enabled:
        profile_times["strategy"] = time.perf_counter() - t_strategy0

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
            log(fp, f"[mesa {mesa}] hands_obs persisted -> obs_id={obs_id} | fp={image_fp}")
    except Exception as e:
        log(fp, f"[mesa {mesa}] hands_obs persist error: {e}")
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
        # Persist metrics to DB for historical analysis
        metrics = {k: float(profile_times.get(k, 0.0)) for k in parts_keys}
        try:
            if hasattr(dbmod, "insert_worker_profile"):
                dbmod.insert_worker_profile(
                    ts=ts,
                    mesa=mesa,
                    capture_id=capture_id,
                    spot_id=cur_spot_id,
                    metrics=metrics,
                )
        except Exception:
            # Profiling should never break la ejecución principal del worker
            pass


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
        persist_to_db=False,
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

        if image_fp and dst:
            try:
                update_obs_frame_ref(dbmod, image_fp, dst)
            except Exception:
                pass

        if out.get("persisted") and new_sig and dst and new_sig != image_fp:
            try:
                update_obs_frame_ref(dbmod, new_sig, dst)
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

        if image_fp and dst:
            try:
                update_obs_frame_ref(dbmod, image_fp, dst)
            except Exception:
                pass

        if out.get("persisted") and new_sig and dst and new_sig != image_fp:
            try:
                update_obs_frame_ref(dbmod, new_sig, dst)
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
