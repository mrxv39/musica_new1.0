# C:\Users\Usuario\Desktop\proyectos\poker_boss\modules\preflop\workers_loop\strategy_pipeline.py
from __future__ import annotations

from typing import Any, Dict, Tuple


def build_ocr_safe(img_path: str) -> Dict[str, Any]:
    from modules.ocr.ocr import run_ocr
    from modules.workers.worker_loop_logic import ensure_ocr_shape

    try:
        ocr = run_ocr(img_path)
        if not isinstance(ocr, dict):
            return ensure_ocr_shape(err="ocr_not_dict")
        return ocr
    except Exception as e:
        return ensure_ocr_shape(err=f"run_ocr:{e}")


def compute_strategy_safe(
    preflop: Dict[str, Any],
    mano_result: Dict[str, Any],
    ocr: Dict[str, Any],
) -> Tuple[Dict[str, Any], str]:
    """
    Devuelve (strategy, err_msg). err_msg vacío si ok.
    """
    from modules.workers.worker_strategy import compute_strategy

    try:
        from modules.strategy.substrategy_selector import MatchInput, select_move  # type: ignore
    except Exception:
        MatchInput = None  # type: ignore
        select_move = None  # type: ignore

    ocr_stacks = ocr.get("stacks", {}) if isinstance(ocr, dict) else {}
    bets_result = ocr.get("bets", {}) if isinstance(ocr, dict) else {}
    stackefectivo_result = ocr.get("stackefectivo", {}) if isinstance(ocr, dict) else {}
    villano_result = ocr.get("villano", {}) if isinstance(ocr, dict) else {}

    try:
        out = compute_strategy(
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
        if not isinstance(out, dict):
            return {"ok": False, "error": "compute_strategy returned non-dict"}, "non_dict"
        return out, ""
    except Exception as e:
        return {"ok": False, "error": f"compute_strategy:{e}"}, str(e)
