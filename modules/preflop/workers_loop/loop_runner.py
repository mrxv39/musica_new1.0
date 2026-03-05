# C:\Users\Usuario\Desktop\proyectos\poker_boss\modules\preflop\workers_loop\loop_runner.py
from __future__ import annotations

import os
import time
import shutil
import uuid
from datetime import datetime
from typing import Any, Dict, TextIO, Tuple, Optional

from .config import PROJECT_ROOT, AREAS, DEFAULT_FALLBACK_SE_ENABLED
from .fs_utils import ensure_dirs, log, safe_move
from .capture import capture_to_tmp

# Keep legacy helper for preflop fail routing
from .preflop_logic import preflop_fail

# SAME pipeline pieces as modules/workers/worker_loop.py
from modules.workers.worker_loop_logic import ensure_ocr_shape, extract_preflop_modules
from modules.workers.worker_loop_types import LoopConfig
from modules.workers.worker_loop import process_one_image


def enable_fallback_env(enabled: bool) -> None:
    if enabled:
        os.environ["POKER_BOSS_FALLBACK_SE"] = "1"
    else:
        os.environ.pop("POKER_BOSS_FALLBACK_SE", None)


def _debug_enabled() -> bool:
    v = (os.environ.get("POKER_BOSS_WORKERS_LOOP_DEBUG", "") or "").strip().lower()
    return v in ("1", "true", "yes", "y", "on")


def _has_strategy_move(strategy: Any) -> bool:
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


def _pytest_fixed_input(base_dir: str) -> Optional[str]:
    """
    Integration tests run this loop as a subprocess. Python monkeypatches in the parent
    do NOT apply in the subprocess. To make the entrypoint deterministic under pytest,
    if we detect pytest and a fixed_input.bmp exists in out_dir, use it as capture source.
    """
    if not os.environ.get("PYTEST_CURRENT_TEST"):
        return None
    p = os.path.join(base_dir, "fixed_input.bmp")
    if os.path.isfile(p):
        return p
    return None


def _force_ok_on_default_fold(strategy: Any) -> Any:
    """
    Tu caso: FOLD por descarte (entra en situación pero no entra en ningún rango).
    En UI se muestra como move=FOLD, betmin=0, betmax=0, pero a veces viene ok=False.

    Para routing + persist queremos tratarlo como una salida válida:
      ok=True, move=FOLD, betmin=0, betmax=0
    """
    if not isinstance(strategy, dict):
        return strategy

    move = (strategy.get("move") or "").strip().upper()
    betmin = strategy.get("betmin", None)
    betmax = strategy.get("betmax", None)

    if move == "FOLD" and betmin == 0 and betmax == 0 and strategy.get("ok") is not True:
        strategy = dict(strategy)  # no mutar ref externa
        strategy["ok"] = True
        # motivo explícito para poder auditar en debug/log
        strategy.setdefault("reason", "default_fold_no_range")
    return strategy


# --------------------------------------------------------------------------------------
# Backwards-compat wrappers (tests patch these)
# --------------------------------------------------------------------------------------

def extract_modules(preflop: Any) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    """
    Legacy name used by tests. Uses the same extractor as worker_loop.py.
    """
    return extract_preflop_modules(preflop)


def _run_ocr_on_copy(img_path: str) -> Dict[str, Any]:
    """
    Windows-safe: run OCR on a temporary copy to avoid WinError 32 file locks
    on the original file in temp directories.
    """
    from modules.ocr.ocr import run_ocr

    base_dir = os.path.dirname(os.path.abspath(img_path))
    root, ext = os.path.splitext(os.path.basename(img_path))
    if not ext:
        ext = ".png"

    copy_path = os.path.join(base_dir, f"{root}__ocr__{uuid.uuid4().hex}{ext}")

    try:
        shutil.copyfile(img_path, copy_path)
        return run_ocr(copy_path)
    finally:
        try:
            if os.path.exists(copy_path):
                os.remove(copy_path)
        except Exception:
            pass


def build_ocr_safe(img_path: str) -> Dict[str, Any]:
    """
    Legacy name used by tests. In production uses run_ocr + ensure_ocr_shape.
    Uses a temp-copy strategy to prevent Windows file-lock cleanup issues in tests.
    """
    ocr: Dict[str, Any] = ensure_ocr_shape()
    try:
        ocr = _run_ocr_on_copy(img_path)
    except Exception as e:
        ocr = ensure_ocr_shape(err=f"run_ocr:{e}")
    return ocr


def compute_strategy_safe(preflop: Any, mano_result: Any, ocr: Any) -> Tuple[Dict[str, Any], str]:
    """
    Legacy name used by tests. Delegates to worker_strategy.compute_strategy,
    matching worker_loop.py inputs as closely as possible.
    Returns (strategy_dict, err_str).
    """
    try:
        from modules.workers.worker_strategy import compute_strategy

        try:
            from modules.strategy.substrategy_selector import MatchInput, select_move
        except Exception:
            MatchInput = None  # type: ignore
            select_move = None  # type: ignore

        ocr_stacks = ocr.get("stacks", {}) if isinstance(ocr, dict) else {}
        bets_result = ocr.get("bets", {}) if isinstance(ocr, dict) else {}
        stackefectivo_result = ocr.get("stackefectivo", {}) if isinstance(ocr, dict) else {}
        villano_result = ocr.get("villano", {}) if isinstance(ocr, dict) else {}

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
        return (strategy, "")
    except Exception as e:
        return ({"ok": False, "error": f"{type(e).__name__}: {e}"}, f"{type(e).__name__}: {e}")


# --------------------------------------------------------------------------------------
# Main loop
# --------------------------------------------------------------------------------------

def run_loop(out_dir: str, interval_ms: int, verbose: bool, fp: TextIO) -> None:
    base_dir = os.path.abspath(out_dir)
    dirs = ensure_dirs(base_dir)

    enable_fallback_env(DEFAULT_FALLBACK_SE_ENABLED)

    log(fp, f"START run_workers_loop base_dir={base_dir} interval_ms={interval_ms} verbose={verbose}")
    log(fp, f"PROJECT_ROOT={PROJECT_ROOT}")
    log(fp, f"POKER_BOSS_FALLBACK_SE={os.environ.get('POKER_BOSS_FALLBACK_SE','')}")

    # IMPORTANT: import module (not symbol) so tests can monkeypatch worker_preflop_mod.run_preflop
    import modules.workers.worker_preflop as worker_preflop_mod

    # pipeline needs dbmod for persist
    from modules.db import db as dbmod

    try:
        from modules.strategy.substrategy_selector import MatchInput, select_move
    except Exception:
        MatchInput = None  # type: ignore
        select_move = None  # type: ignore

    dbg = _debug_enabled()

    # keep dedupe per mesa
    last_sig_by_mesa: Dict[int, Optional[str]] = {}

    fixed_input = _pytest_fixed_input(base_dir)

    while True:
        ts = datetime.now().strftime("%Y%m%d_%H%M%S_%f")

        for area in AREAS:
            mesa = int(area["mesa"])
            last_sig_by_mesa.setdefault(mesa, None)

            # 1) capture tmp
            try:
                if fixed_input:
                    img_path = os.path.join(dirs.tmp_dir, f"{ts}__mesa_{mesa}.bmp")
                    shutil.copy2(fixed_input, img_path)
                else:
                    img_path = capture_to_tmp(area, dirs.tmp_dir, ts)
            except Exception as e:
                log(fp, f"[mesa {mesa}] CAPTURE ERROR: {e}")
                continue

            # 2) preflop (patched in tests)
            try:
                preflop: Dict[str, Any] = worker_preflop_mod.run_preflop(img_path)  # type: ignore
            except Exception as e:
                preflop = {"preflop_ok": False, "error": f"run_preflop:{e}"}

            # Keep legacy early routing rule
            if preflop_fail(preflop):
                dst = safe_move(img_path, dirs.del_dir)
                if verbose:
                    log(fp, f"[mesa {mesa}] preflop FAIL -> borrar: {dst}")
                continue

            # 3) modules via wrapper (tests patch extract_modules)
            mano_result, _stacks_result = extract_modules(preflop)

            # 4) OCR via wrapper (tests patch build_ocr_safe)
            ocr = build_ocr_safe(img_path)

            # 5) strategy via wrapper (tests patch compute_strategy_safe)
            strategy, err = compute_strategy_safe(preflop, mano_result, ocr)
            strategy = _force_ok_on_default_fold(strategy)

            # 6) run REAL persist/dedupe pipeline using process_one_image, injecting already computed values
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
                return (mano_result, _stacks_result)

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

            # 7) routing (legacy rules preserved)
            if _has_strategy_move(strategy):
                dst = safe_move(img_path, dirs.ok_dir)
                if verbose:
                    log(fp, f"[mesa {mesa}] OK -> ok: {dst}")
            else:
                dst = safe_move(img_path, dirs.err_dir)
                if verbose:
                    reason = None
                    if isinstance(strategy, dict):
                        reason = strategy.get("error") or strategy.get("reason")
                    log(fp, f"[mesa {mesa}] NO STRATEGY -> errors: {dst} | reason={(reason or err or 'no_move/bets')}")

                if dbg:
                    try:
                        dbg_payload = {
                            "mesa": mesa,
                            "fallback_se": os.environ.get("POKER_BOSS_FALLBACK_SE", ""),
                            "preflop_ok": bool(preflop.get("preflop_ok")) if isinstance(preflop, dict) else None,
                            "strategy": strategy if isinstance(strategy, dict) else str(strategy),
                            "ocr": ocr if isinstance(ocr, dict) else str(ocr),
                            "out": out,
                        }
                        dbg_path = dst + ".debug.json"
                        with open(dbg_path, "w", encoding="utf-8") as f:
                            import json
                            json.dump(dbg_payload, f, ensure_ascii=False, indent=2)
                    except Exception:
                        pass

        time.sleep(max(150, interval_ms) / 1000.0)
