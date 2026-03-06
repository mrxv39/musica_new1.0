from __future__ import annotations

import os
import shutil
import uuid
from typing import Any, Dict, Tuple

from modules.workers.worker_loop_logic import ensure_ocr_shape, extract_preflop_modules


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
