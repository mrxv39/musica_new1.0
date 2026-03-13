from __future__ import annotations

from typing import Any, Dict, Optional


def _to_float(v: Any) -> Optional[float]:
    try:
        if v is None or v == "":
            return None
        return float(v)
    except Exception:
        return None


def _in_range(x: Optional[float], lo: float = 0.01, hi: float = 75.0) -> bool:
    if x is None:
        return False
    return lo <= float(x) <= hi


def _seat_for_role(posiciones: Dict[str, Any], role: str) -> Optional[str]:
    want = str(role or "").upper().strip()
    if not want:
        return None
    for seat in ("p1", "p2", "p3"):
        if str(posiciones.get(seat, "") or "").upper().strip() == want:
            return seat
    return None


def compute_effective_stack_bb(
    *,
    posiciones: Any,
    stacks: Any,
    bets: Any,
    bb: Optional[float] = None,
    lo: float = 0.01,
    hi: float = 75.0,
) -> Optional[float]:
    """
    Derive an effective stack (SE) in BB from OCR stacks + positions (+ bets).

    Assumptions (current project):
    - seats are p1(hero), p2, p3
    - posiciones maps p1/p2/p3 -> BTN/SB/BB
    - stacks maps p1/p2/p3 -> stack in BB, unless `bb` is provided
    - bets maps p1/p2/p3 -> bet in BB, unless `bb` is provided

    Conservative, high-confidence rules:
    - Valid numeric outputs must be within [0.01, 75.00] BB.
    - If hero is NOT BTN and BTN bet is 0, treat BTN as folded (exclude from opponents).
    - Effective stack is min(hero_stack, max(opponent_stacks_remaining)).
      (Matches the working examples: vs caller who continues, not necessarily the shortest stack.)
    """
    if not isinstance(posiciones, dict) or not isinstance(stacks, dict):
        return None

    # IMPORTANT:
    # In our OCR pipeline, `stacks.*` can represent the remaining stack behind,
    # while `bets.*` represents chips already committed this street (incl. blinds).
    # For effective stack we need TOTAL stack available in the hand:
    #   total_stack = behind + committed
    if not isinstance(bets, dict):
        bets = {}

    def total_stack(seat: str) -> Optional[float]:
        behind = _to_float(stacks.get(seat))
        committed = _to_float(bets.get(seat))
        if behind is None and committed is None:
            return None
        behind = behind or 0.0
        committed = committed or 0.0
        tot = float(behind) + float(committed)
        return tot

    hero_total = total_stack("p1")
    if hero_total is None:
        return None

    # Determine hero role + BTN seat for fold inference
    hero_role = str(posiciones.get("p1", "") or "").upper().strip()
    btn_seat = _seat_for_role(posiciones, "BTN")

    exclude = set()
    if hero_role != "BTN" and btn_seat and isinstance(bets, dict):
        btn_bet = _to_float(bets.get(btn_seat))
        # BTN has no blind: bet == 0 is a good fold signal
        if btn_bet is not None and btn_bet <= 0.0:
            exclude.add(btn_seat)

    opp_totals: list[float] = []
    for seat in ("p2", "p3"):
        if seat in exclude:
            continue
        v = total_stack(seat)
        if v is not None:
            opp_totals.append(float(v))

    if not opp_totals:
        return None

    # Effective stack: min(hero_total, max(opponent_totals_remaining))
    # (matches examples where only opponents that continue matter; fold inference above reduces set)
    se = min(float(hero_total), max(opp_totals))
    if bb is not None:
        bb_value = _to_float(bb)
        if bb_value is None or bb_value <= 0.0:
            return None
        se_bb = float(se) / float(bb_value)
    else:
        se_bb = float(se)

    if not _in_range(se_bb, lo, hi):
        return None
    return float(round(se_bb, 2))

