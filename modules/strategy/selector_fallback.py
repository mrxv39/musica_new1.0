# C:\Users\Usuario\Desktop\proyectos\poker_boss\modules\strategy\selector_fallback.py
from __future__ import annotations

import sqlite3
from typing import Dict, List, Optional, Tuple

from .selector_models import MatchInput, SubStrategySpec
from .selector_matching import match_categorical
from .selector_utils import load_payload


def fallback_nearest_se(
    inp: MatchInput,
    rows_with_specs: List[Tuple[sqlite3.Row, SubStrategySpec]],
) -> Optional[Tuple[sqlite3.Row, Dict[str, object], str]]:
    """
    Fallback rule (when strict yields 0 matches):
      - require all categorical fields match
      - require all numeric bounds match EXCEPT p1_se
      - choose the row whose p1_se interval is nearest to inp.p1_se_bb (min distance)
      - if tie -> None (ambiguous)

    Returns:
      (row, payload, debug_note) or None
    """
    candidates: List[Tuple[sqlite3.Row, SubStrategySpec]] = []
    for row, spec in rows_with_specs:
        if match_categorical(inp, spec) is not None:
            continue

        # Check numeric fields excluding p1_se
        if not spec.p1_bet.contains(inp.p1_bet_bb):
            continue
        if not spec.p1_stack.contains(inp.p1_stack_bb):
            continue

        if not spec.p2_bet.contains(inp.p2_bet_bb):
            continue
        if not spec.p2_stack.contains(inp.p2_stack_bb):
            continue

        if not spec.p3_bet.contains(inp.p3_bet_bb):
            continue
        if not spec.p3_stack.contains(inp.p3_stack_bb):
            continue

        candidates.append((row, spec))

    if not candidates:
        return None

    scored: List[Tuple[float, int, sqlite3.Row, SubStrategySpec]] = []
    for row, spec in candidates:
        dist = spec.p1_se.distance_to_interval(inp.p1_se_bb)
        scored.append((dist, int(row["id"]), row, spec))
    scored.sort(key=lambda t: (t[0], t[1]))

    best_dist, best_id, best_row, best_spec = scored[0]
    tied = [t for t in scored if t[0] == best_dist]
    if len(tied) > 1:
        return None

    payload = load_payload(best_row)
    note = f"fallback_se:chosen_id={best_id},dist={best_dist},se_val={inp.p1_se_bb},se_bounds={best_spec.p1_se}"
    return best_row, payload, note