from __future__ import annotations

import sqlite3
from dataclasses import dataclass
from typing import Any, Optional

from modules.strategy.range_parser import hand_in_range, normalize_hand_class


@dataclass(frozen=True)
class SpotStrategyMatchInput:
    spot_key: str
    hand_class: str
    p1_se_bb: float
    p1_bet_bb: float
    p2_pos: str
    p3_pos: str
    p2_tipo: str
    p3_tipo: str


def _norm(v: Any) -> str:
    return "" if v is None else str(v).strip()


def _norm_tipo(v: Any) -> str:
    # DB/Excel uses e.g. "fish"/"reg"; worker might bring "FISH"/"REG".
    return _norm(v).lower()


def _norm_pos(v: Any) -> str:
    return _norm(v).upper()


def _row_text(row: sqlite3.Row, key: str) -> str:
    try:
        return _norm(row[key])
    except Exception:
        return ""


def _row_float(row: sqlite3.Row, key: str) -> Optional[float]:
    try:
        v = row[key]
    except Exception:
        return None
    if v is None or v == "":
        return None
    try:
        return float(v)
    except Exception:
        return None


def _matches_nullable_text(row_value: str, inp_value: str, *, normalizer) -> bool:
    rv = normalizer(row_value)
    if rv == "":
        return True
    return rv == normalizer(inp_value)


def _matches_range(min_v: Optional[float], max_v: Optional[float], x: float) -> bool:
    if min_v is None or max_v is None:
        return True
    return float(min_v) <= float(x) <= float(max_v)


def _specificity_score(row: sqlite3.Row) -> tuple[int, int, int, int, float, float]:
    """
    Higher is more specific.
    - Prefer rows that specify tipos/pos.
    - Prefer rows with bet_min/max specified.
    - Prefer tighter SE range.
    """
    p2_tipo = 1 if _row_text(row, "p2_tipo") != "" else 0
    p3_tipo = 1 if _row_text(row, "p3_tipo") != "" else 0
    pos = 1 if (_row_text(row, "p2_pos") != "" or _row_text(row, "p3_pos") != "") else 0
    bet = 1 if (_row_float(row, "bet_min") is not None and _row_float(row, "bet_max") is not None) else 0
    se_min = _row_float(row, "stack_effective_min") or 0.0
    se_max = _row_float(row, "stack_effective_max") or 0.0
    se_width = se_max - se_min
    bet_min = _row_float(row, "bet_min")
    bet_max = _row_float(row, "bet_max")
    bet_width = (bet_max - bet_min) if (bet_min is not None and bet_max is not None) else 9999.0
    # negative widths so tighter => larger score component
    return (p2_tipo, p3_tipo, pos, bet, -se_width, -bet_width)


def find_unique_spot_strategy_id(
    conn: sqlite3.Connection, inp: SpotStrategyMatchInput
) -> Optional[int]:
    try:
        hc = normalize_hand_class(inp.hand_class)
    except ValueError:
        return None

    cur = conn.cursor()
    cur.execute(
        """
        SELECT *
        FROM spots_strategies
        WHERE spot_key = ?
          AND stack_effective_min <= ?
          AND stack_effective_max >= ?
        """,
        (_norm_pos(inp.spot_key), float(inp.p1_se_bb), float(inp.p1_se_bb)),
    )
    rows = list(cur.fetchall())
    if not rows:
        raise ValueError("No spot strategies found for spot_key+SE")

    matches: list[sqlite3.Row] = []
    for r in rows:
        if not _matches_nullable_text(_row_text(r, "p2_tipo"), inp.p2_tipo, normalizer=_norm_tipo):
            continue
        if not _matches_nullable_text(_row_text(r, "p3_tipo"), inp.p3_tipo, normalizer=_norm_tipo):
            continue
        if not _matches_nullable_text(_row_text(r, "p2_pos"), inp.p2_pos, normalizer=_norm_pos):
            continue
        if not _matches_nullable_text(_row_text(r, "p3_pos"), inp.p3_pos, normalizer=_norm_pos):
            continue
        if not _matches_range(_row_float(r, "bet_min"), _row_float(r, "bet_max"), float(inp.p1_bet_bb)):
            continue
        matches.append(r)

    if not matches:
        raise ValueError("No matching spot strategy after applying constraints")

    matches_hand: list[sqlite3.Row] = []
    for r in matches:
        hr = _row_text(r, "hand_range")
        if hr and hand_in_range(hc, hr):
            matches_hand.append(r)

    if not matches_hand:
        return None

    if len(matches_hand) == 1:
        return int(matches_hand[0]["id"])

    matches_sorted = sorted(matches_hand, key=_specificity_score, reverse=True)
    best_score = _specificity_score(matches_sorted[0])
    best = [r for r in matches_sorted if _specificity_score(r) == best_score]
    if len(best) == 1:
        return int(best[0]["id"])

    ids = [int(r["id"]) for r in best[:10] if "id" in r.keys()]
    raise ValueError(f"Ambiguous spot strategy match: {len(best)} candidates share top specificity (ids~={ids})")

