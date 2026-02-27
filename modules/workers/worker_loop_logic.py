# C:\Users\Usuario\Desktop\proyectos\poker_boss\modules\workers\worker_loop_logic.py
from __future__ import annotations

from typing import Any, Dict, Optional, Tuple


def parse_bool(v: Any) -> bool:
    if isinstance(v, bool):
        return v
    if v is None:
        return False
    s = str(v).strip().lower()
    return s in ("1", "true", "yes", "y", "on")


def ensure_ocr_shape(err: Optional[str] = None) -> Dict[str, Any]:
    errors = ["no_image"] if err is None else [err]
    return {
        "ok": False,
        "errors": errors,
        "names": {},
        "villano": {},
        "stackefectivo": {},
        "bets": {},
        "stacks": {},
    }


def extract_preflop_modules(preflop: Any) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    mano_result: Dict[str, Any] = {"valid": False, "mano_raw": None}
    stacks_result: Dict[str, Any] = {"p1": None}
    if isinstance(preflop, dict):
        mods = preflop.get("modules")
        if isinstance(mods, dict):
            mano_result = mods.get("mano", mano_result)
            stacks_result = mods.get("stacks", stacks_result)
    return mano_result, stacks_result
