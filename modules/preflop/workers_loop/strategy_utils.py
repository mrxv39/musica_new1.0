from __future__ import annotations

from typing import Any


def has_strategy_move(strategy: Any) -> bool:
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


def force_ok_on_default_fold(strategy: Any) -> Any:
    """
    Caso: FOLD por descarte (entra en situación pero no entra en ningún rango).
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
        strategy.setdefault("reason", "default_fold_no_range")
    return strategy
