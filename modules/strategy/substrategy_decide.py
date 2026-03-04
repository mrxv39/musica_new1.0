# C:\Users\Usuario\Desktop\proyectos\poker_boss\modules\strategy\substrategy_decide.py
from __future__ import annotations

from typing import Any, Dict, List, Optional

from .range_parser import hand_in_range, normalize_hand_class
from .selector_models import MatchInput
from .selector_utils import as_text

from .substrategy_constants import OR_KEYS, OR_BLOCK_MOVE_BY_KEY


def _safe_float(x: Any, default: float = 0.0) -> float:
    try:
        if x is None:
            return default
        return float(x)
    except (TypeError, ValueError):
        return default


def _chart_get_entry(chart: Any, hand_class: str) -> Optional[Dict[str, Any]]:
    """
    Soporta chart en formato:
      - dict: {"KQo": {"min":0,"max":15}, ...}
      - list: [{"hand":"KQo","min":0,"max":15}, ...]  (defensivo)
    """
    if isinstance(chart, dict):
        v = chart.get(hand_class)
        return v if isinstance(v, dict) else None

    if isinstance(chart, list):
        for it in chart:
            if not isinstance(it, dict):
                continue
            k = it.get("hand") or it.get("key") or it.get("hc") or it.get("hand_class")
            if not k:
                continue
            if normalize_hand_class(str(k)) == hand_class:
                return it
    return None


def decide_move(payload: Dict[str, Any], inp: MatchInput) -> Dict[str, Any]:
    """
    Decide plan por rangos / modos.

    OR logic:
      - Tests: orRanges + orRangesPlan
      - DB real: or_blocks (key -> {min,max,range})

    Nash logic:
      - mode == NASH_PUSHFOLD -> payload["nash"]["chart"][hand_class] -> {min,max} (en BB de SE)

    Regla:
      - Si NO entra en ningún rango / chart => FOLD + bet 0/0
    """
    hc = normalize_hand_class(inp.hand_class)
    mode = str(payload.get("mode") or "").upper().strip()

    # -----------------------------
    # 0) NASH_PUSHFOLD
    # -----------------------------
    if mode == "NASH_PUSHFOLD":
        nash = payload.get("nash")
        if not isinstance(nash, dict):
            nash = {}
        chart = nash.get("chart")

        entry = _chart_get_entry(chart, hc)
        if not entry:
            return {"range_key": "FOLD", "move": "FOLD", "bet_min_bb": 0.0, "bet_max_bb": 0.0}

        min_bb = _safe_float(entry.get("min", 0), default=0.0)
        max_bb = _safe_float(entry.get("max", 0), default=0.0)
        se_bb = _safe_float(inp.p1_se_bb, default=0.0)

        if min_bb <= se_bb <= max_bb:
            stack_bb = _safe_float(inp.p1_stack_bb, default=0.0)
            return {
                "range_key": "NASH",
                "move": "PUSH",
                "bet_min_bb": stack_bb / 2.0,
                "bet_max_bb": stack_bb,
            }

        return {"range_key": "FOLD", "move": "FOLD", "bet_min_bb": 0.0, "bet_max_bb": 0.0}

    # -----------------------------
    # 1) OR ranges (tests)
    # -----------------------------
    or_ranges = payload.get("orRanges") or payload.get("or_ranges") or {}
    plan = payload.get("orRangesPlan") or {}

    matched_keys: List[str] = []
    if isinstance(or_ranges, dict):
        for k in OR_KEYS:
            rng = as_text(or_ranges.get(k, "") or "")
            if rng and hand_in_range(hc, rng):
                matched_keys.append(k)

    # -----------------------------
    # 2) OR blocks (DB)
    # -----------------------------
    if not matched_keys:
        ob = payload.get("or_blocks") or {}
        if isinstance(ob, dict):
            for k in OR_KEYS:
                v = ob.get(k)
                if not isinstance(v, dict):
                    continue
                rng = as_text(v.get("range", "") or "")
                if rng and hand_in_range(hc, rng):
                    matched_keys.append(k)

    if len(matched_keys) > 1:
        raise ValueError(f"Hand {hc} matches multiple ranges: {matched_keys}")

    if not matched_keys:
        return {"range_key": "FOLD", "move": "FOLD", "bet_min_bb": 0.0, "bet_max_bb": 0.0}

    key = matched_keys[0]

    # Prefer plan if available (tests)
    p = plan.get(key) if isinstance(plan, dict) else None
    if isinstance(p, dict) and (p.get("move") is not None or p.get("bet_min_bb") is not None or p.get("bet_max_bb") is not None):
        move = p.get("move", None)
        bet_min = p.get("bet_min_bb", None)
        bet_max = p.get("bet_max_bb", None)

        move = str(move) if move is not None else None
        bet_min = float(bet_min) if bet_min is not None else None
        bet_max = float(bet_max) if bet_max is not None else None

        return {"range_key": key, "move": move, "bet_min_bb": bet_min, "bet_max_bb": bet_max}

    # DB or_blocks
    ob = payload.get("or_blocks") or {}
    if isinstance(ob, dict):
        v = ob.get(key)
        if isinstance(v, dict):
            move = OR_BLOCK_MOVE_BY_KEY.get(key, "FOLD")
            bet_min = _safe_float(v.get("min", 0), default=0.0)
            bet_max = _safe_float(v.get("max", 0), default=0.0)
            return {"range_key": key, "move": move, "bet_min_bb": bet_min, "bet_max_bb": bet_max}

    return {"range_key": "FOLD", "move": "FOLD", "bet_min_bb": 0.0, "bet_max_bb": 0.0}
