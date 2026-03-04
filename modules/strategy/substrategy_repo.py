# C:\Users\Usuario\Desktop\proyectos\poker_boss\modules\strategy\substrategy_repo.py
from __future__ import annotations

import sqlite3
from typing import Any, Dict, List, Tuple

from .selector_models import MatchInput, SubStrategySpec
from .selector_utils import env_truthy, load_payload
from .selector_matching import match_row_strict
from .selector_diagnostics import build_failure_error_message
from .selector_fallback import fallback_nearest_se


def fetch_rows(conn: sqlite3.Connection) -> List[sqlite3.Row]:
    """Fetch candidate rows from definitive schema.
      - spots.name is canonical situation key (via spot_id)
    """
    sql = """
        SELECT ss.*, s.name AS situation_key
        FROM strategies ss
        JOIN spots s ON s.id = ss.spot_id
    """
    cur = conn.execute(sql)
    return list(cur.fetchall())


def find_unique_substrategy(conn: sqlite3.Connection, inp: MatchInput) -> Tuple[sqlite3.Row, Dict[str, Any]]:
    rows = fetch_rows(conn)
    if not rows:
        raise ValueError("No strategies rows in database")

    matches: List[Tuple[sqlite3.Row, Dict[str, Any]]] = []
    reasons: Dict[str, int] = {}
    rows_with_specs: List[Tuple[sqlite3.Row, SubStrategySpec]] = []

    for r in rows:
        ok, reason, spec = match_row_strict(inp, r)
        if ok:
            matches.append((r, load_payload(r)))
        else:
            reasons[reason] = reasons.get(reason, 0) + 1
        if spec is not None:
            rows_with_specs.append((r, spec))

    if len(matches) == 1:
        row, payload = matches[0]
        return row, payload

    fallback_enabled = env_truthy("POKER_BOSS_FALLBACK_SE", default="0")
    if len(matches) == 0 and fallback_enabled:
        fb = fallback_nearest_se(inp, rows_with_specs)
        if fb is not None:
            row, payload, note = fb
            payload = dict(payload)
            payload["_match_note"] = note
            return row, payload

    msg = build_failure_error_message(
        inp=inp,
        matches=matches,
        reasons=reasons,
        rows_with_specs=rows_with_specs,
        fallback_se_enabled=fallback_enabled,
    )
    raise ValueError(msg)
