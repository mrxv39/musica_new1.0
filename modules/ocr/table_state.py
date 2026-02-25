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

    Safety:
      - ok=True ONLY when players in {2,3}
      - otherwise ok=False (prevents false positives when OCR fails)
    """
    names_result = names_result or {}
    stacks_result = stacks_result or {}

    # names module currently yields p2_name/p3_name; p1_name may be absent
    seat_name = {
        "p1": (names_result.get("p1_name") or "").strip(),  # usually not present
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
    ok = players in (2, 3)

    out = {
        "ok": ok,
        "players": players,
        "is_3h": players == 3,
        "is_hu": players == 2,
        "active_seats": active_seats,
        "eliminated_seats": eliminated_seats,
        "method": "names_empty_and_stack_null",
        "errors": [],
    }

    if not ok:
        out["errors"].append("unknown_players_count")

    return out