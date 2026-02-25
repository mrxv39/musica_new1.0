# C:\Users\Usuario\Desktop\proyectos\poker_boss\modules\ocr\table_state.py
# Table state: derive 3H / HU from OCR outputs (names + stacks)

from __future__ import annotations
from typing import Dict, Any, Optional


def compute_table_state(
    names_result: Optional[Dict[str, Any]],
    stacks_result: Optional[Dict[str, Any]],
) -> Dict[str, Any]:
    """
    Rules (per user confirmation):
      - Eliminated player => no name AND stack is NULL (None)
      - 3H True when 3 active players
      - HU True when 2 active players

    Important for orchestrator correctness:
      - ok=True ONLY when players is 2 or 3.
      - If players is 0/1 -> ok=False (insufficient/unknown state).
    """
    names_result = names_result or {}
    stacks_result = stacks_result or {}

    seat_name = {
        "p1": (names_result.get("p1_name") or "").strip(),  # usually absent
        "p2": (names_result.get("p2_name") or "").strip(),
        "p3": (names_result.get("p3_name") or "").strip(),
    }

    seat_stack = {
        "p1": stacks_result.get("p1", None),
        "p2": stacks_result.get("p2", None),
        "p3": stacks_result.get("p3", None),
    }

    active_seats = []
    eliminated_seats = []

    for seat in ("p1", "p2", "p3"):
        name = seat_name.get(seat, "")
        stack = seat_stack.get(seat, None)

        eliminated = (stack is None) and (name == "")
        if eliminated:
            eliminated_seats.append(seat)
        else:
            active_seats.append(seat)

    players = len(active_seats)
    is_3h = players == 3
    is_hu = players == 2

    ok = is_3h or is_hu
    errors = []
    if not ok:
        errors.append("players_unknown")

    return {
        "ok": ok,
        "players": players,
        "is_3h": is_3h,
        "is_hu": is_hu,
        "active_seats": active_seats,
        "eliminated_seats": eliminated_seats,
        "method": "names_empty_and_stack_null",
        "errors": errors,
    }
