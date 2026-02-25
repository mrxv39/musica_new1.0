# C:\Users\Usuario\Desktop\proyectos\poker_boss\modules\ocr\posiciones.py
# Derive positions (BTN/SB/BB) using dealer button first, then bets pattern fallback.
# Safe mode: only returns ok=True when pattern is unambiguous.

from __future__ import annotations
from typing import Dict, Any, Optional


def _is_close(a: float, b: float, eps: float = 1e-6) -> bool:
    return abs(a - b) <= eps


def _seat_cycle_order() -> list:
    """
    Your table seat order based on confirmed mapping:
      If dealer on p1 in 3H => p1=BTN, p2=SB, p3=BB
    Therefore cycle is: p1 -> p2 -> p3 -> p1
    """
    return ["p1", "p2", "p3"]


def _next_seat(seat: str) -> str:
    order = _seat_cycle_order()
    if seat not in order:
        return ""
    return order[(order.index(seat) + 1) % len(order)]


def _other_active_seat(active_seats: list, seat: str) -> str:
    for s in active_seats:
        if s != seat:
            return s
    return ""


def read_posiciones(
    table_state: Optional[Dict[str, Any]],
    bets_result: Optional[Dict[str, Any]],
    dealer_result: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Priority:
      1) Dealer button detection (most stable)
         - 3H: dealer_seat=BTN, next=SB, next=BB
         - HU: dealer_seat=SB/BTN, other=BB
      2) Bets pattern fallback (user confirmed):
         - 3H: {0.0,0.5,1.0} => 0.0=BTN, 0.5=SB, 1.0=BB
         - HU: {0.5,1.0} => 0.5=SB/BTN, 1.0=BB

    Safety:
      - Only ok=True when we can assign positions unambiguously.
    """
    table_state = table_state or {}
    bets_result = bets_result or {}
    dealer_result = dealer_result or {}

    players = int(table_state.get("players") or 0)
    is_hu = bool(table_state.get("is_hu"))
    is_3h = bool(table_state.get("is_3h"))
    active_seats = table_state.get("active_seats") or []

    out: Dict[str, Any] = {
        "ok": False,
        "p1": "",
        "p2": "",
        "p3": "",
        "players": players,
        "method": "",
        "errors": [],
        "debug": {},
    }

    # ---------------------------
    # 1) Dealer-based assignment
    # ---------------------------
    if dealer_result.get("ok") and dealer_result.get("dealer_seat"):
        dealer_seat = dealer_result.get("dealer_seat")
        if active_seats and dealer_seat not in active_seats:
            # Detected dealer on an eliminated seat -> ambiguous
            out["method"] = "dealer_button"
            out["errors"].append("dealer_on_inactive_seat")
            out["debug"]["dealer_seat"] = dealer_seat
            out["debug"]["active_seats"] = active_seats
            return out

        out["method"] = "dealer_button"
        out["debug"]["dealer_seat"] = dealer_seat
        out["debug"]["dealer_score"] = dealer_result.get("score", 0.0)

        # HU
        if is_hu or players == 2:
            if not active_seats:
                # fallback: assume p1/p2 active if unknown
                active_seats = ["p1", "p2"]
            other = _other_active_seat(active_seats, dealer_seat)
            if not other:
                out["errors"].append("hu_other_seat_not_found")
                return out

            # Dealer in HU is SB/BTN
            out[dealer_seat] = "SB"
            out[other] = "BB"
            out["dealer_seat"] = dealer_seat
            out["btn_seat"] = dealer_seat
            out["sb_seat"] = dealer_seat
            out["bb_seat"] = other
            out["ok"] = True
            return out

        # 3H
        if is_3h or players == 3:
            sb_seat = _next_seat(dealer_seat)
            bb_seat = _next_seat(sb_seat)
            if not sb_seat or not bb_seat:
                out["errors"].append("3h_cycle_failed")
                return out

            out[dealer_seat] = "BTN"
            out[sb_seat] = "SB"
            out[bb_seat] = "BB"
            out["dealer_seat"] = dealer_seat
            out["btn_seat"] = dealer_seat
            out["sb_seat"] = sb_seat
            out["bb_seat"] = bb_seat
            out["ok"] = True
            return out

        out["errors"].append("unknown_players_count")
        return out

    # -----------------------------------
    # 2) Bets pattern fallback (existing)
    # -----------------------------------
    p1 = float(bets_result.get("p1") or 0.0)
    p2 = float(bets_result.get("p2") or 0.0)
    p3 = float(bets_result.get("p3") or 0.0)

    raw = (bets_result.get("raw") or {})
    raw_p1 = (raw.get("p1") or "").strip()
    raw_p2 = (raw.get("p2") or "").strip()
    raw_p3 = (raw.get("p3") or "").strip()

    out["method"] = "bets_blinds_pattern"
    out["debug"] = {
        "bets": {"p1": p1, "p2": p2, "p3": p3},
        "raw": {"p1": raw_p1, "p2": raw_p2, "p3": raw_p3},
    }

    # HU: only p1/p2 are relevant; p3 likely eliminated
    if is_hu or players == 2:
        seats = {"p1": p1, "p2": p2}
        values = sorted(seats.values())
        if len(values) == 2 and _is_close(values[0], 0.5) and _is_close(values[1], 1.0):
            for seat, v in seats.items():
                if _is_close(v, 0.5):
                    out[seat] = "SB"
                    out["dealer_seat"] = seat
                    out["btn_seat"] = seat
                    out["sb_seat"] = seat
                elif _is_close(v, 1.0):
                    out[seat] = "BB"
                    out["bb_seat"] = seat
            out["ok"] = True
            return out

        out["errors"].append("pattern_not_matched")
        return out

    # 3H:
    if is_3h or players == 3:
        seats = {"p1": p1, "p2": p2, "p3": p3}
        values = sorted(seats.values())
        if len(values) == 3 and _is_close(values[0], 0.0) and _is_close(values[1], 0.5) and _is_close(values[2], 1.0):
            for seat, v in seats.items():
                if _is_close(v, 0.0):
                    out[seat] = "BTN"
                    out["dealer_seat"] = seat
                    out["btn_seat"] = seat
                elif _is_close(v, 0.5):
                    out[seat] = "SB"
                    out["sb_seat"] = seat
                elif _is_close(v, 1.0):
                    out[seat] = "BB"
                    out["bb_seat"] = seat
            out["ok"] = True
            return out

        out["errors"].append("pattern_not_matched")
        return out

    out["errors"].append("unknown_players_count")
    return out