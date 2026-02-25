# C:\Users\Usuario\Desktop\proyectos\poker_boss\modules\ocr\posiciones.py
# Derive positions (BTN/SB/BB) using bets pattern heuristics.
# Safe mode: only returns ok=True when pattern is unambiguous.

from __future__ import annotations
from typing import Dict, Any, Optional


def _is_close(a: float, b: float, eps: float = 1e-6) -> bool:
    return abs(a - b) <= eps


def read_posiciones(
    table_state: Optional[Dict[str, Any]],
    bets_result: Optional[Dict[str, Any]],
) -> Dict[str, Any]:
    """
    Heuristic rule (user confirmed):
      - In 3H, when blinds just posted and no other action:
          bet "" (=> 0.0) => BTN
          bet 0.5         => SB
          bet 1.0         => BB
      - In HU (2 players):
          bet 0.5 => SB/BTN
          bet 1.0 => BB
    Safety:
      - Only ok=True when pattern matches EXACTLY.
      - Otherwise ok=False with error 'pattern_not_matched'.
    """
    table_state = table_state or {}
    bets_result = bets_result or {}

    players = int(table_state.get("players") or 0)
    is_hu = bool(table_state.get("is_hu"))
    is_3h = bool(table_state.get("is_3h"))

    p1 = float(bets_result.get("p1") or 0.0)
    p2 = float(bets_result.get("p2") or 0.0)
    p3 = float(bets_result.get("p3") or 0.0)

    raw = (bets_result.get("raw") or {})
    raw_p1 = (raw.get("p1") or "").strip()
    raw_p2 = (raw.get("p2") or "").strip()
    raw_p3 = (raw.get("p3") or "").strip()

    out: Dict[str, Any] = {
        "ok": False,
        "p1": "",
        "p2": "",
        "p3": "",
        "players": players,
        "method": "bets_blinds_pattern",
        "errors": [],
        "debug": {
            "bets": {"p1": p1, "p2": p2, "p3": p3},
            "raw": {"p1": raw_p1, "p2": raw_p2, "p3": raw_p3},
        },
    }

    # HU: only p1/p2 are relevant; p3 likely eliminated (stack None)
    if is_hu or players == 2:
        seats = {"p1": p1, "p2": p2}
        # exactly {0.5, 1.0}
        values = sorted(seats.values())
        if len(values) == 2 and _is_close(values[0], 0.5) and _is_close(values[1], 1.0):
            for seat, v in seats.items():
                if _is_close(v, 0.5):
                    out[seat] = "SB"   # dealer in HU
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
        # exactly {0.0, 0.5, 1.0}
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
