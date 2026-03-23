# C:\Users\Usuario\Desktop\proyectos\poker_boss\modules\preflop\workers_loop\preflop_logic.py
from __future__ import annotations

from typing import Any, Dict, Tuple


def preflop_fail(preflop: Any) -> bool:
    """Check if preflop failed. Only checks mano and noboard — time gate is
    already verified by the worker loop before calling preflop, so we do NOT
    re-check preflop_ok (which includes time)."""
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


def has_move_bets(strategy: Any) -> bool:
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


def extract_modules(preflop: Dict[str, Any]) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    """
    Wrapper por claridad: usa exactamente el helper del worker real.
    """
    from modules.workers.worker_loop_logic import extract_preflop_modules  # import local
    return extract_preflop_modules(preflop)
