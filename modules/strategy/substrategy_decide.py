# C:\Users\Usuario\Desktop\proyectos\poker_boss\modules\strategy\substrategy_decide.py
from __future__ import annotations

from typing import Any, Dict, List

from .range_parser import hand_in_range, normalize_hand_class
from .selector_utils import as_text

from .substrategy_constants import OR_KEYS, OR_BLOCK_MOVE_BY_KEY


def decide_move(payload: Dict[str, Any], hand_class: str) -> Dict[str, Any]:
    """
    Decide plan por rangos.

    - Tests: orRanges + orRangesPlan
    - DB real: or_blocks (key -> {min,max,range})

    Regla:
      - Si NO entra en ningún rango => FOLD + bet 0/0
    """
    hc = normalize_hand_class(hand_class)

    # 1) Formato tests: orRanges + plan
    or_ranges = payload.get("orRanges") or payload.get("or_ranges") or {}
    plan = payload.get("orRangesPlan") or {}

    matched_keys: List[str] = []
    if isinstance(or_ranges, dict):
        for k in OR_KEYS:
            rng = as_text(or_ranges.get(k, "") or "")
            if rng and hand_in_range(hc, rng):
                matched_keys.append(k)

    # 2) Formato DB: or_blocks
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
            bet_min = float(v.get("min", 0) or 0)
            bet_max = float(v.get("max", 0) or 0)
            return {"range_key": key, "move": move, "bet_min_bb": bet_min, "bet_max_bb": bet_max}

    return {"range_key": "FOLD", "move": "FOLD", "bet_min_bb": 0.0, "bet_max_bb": 0.0}
