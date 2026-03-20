from __future__ import annotations

import re
import sqlite3
from dataclasses import dataclass
from typing import Any, Optional

from .range_parser import hand_in_range, normalize_hand_class


@dataclass(frozen=True)
class SpotDecisionInput:
    spot_key: str
    hand_class: str
    p1_se_bb: float
    p1_bet_bb: float
    p2_pos: str
    p3_pos: str
    p2_tipo: str
    p3_tipo: str


def _t(v: Any) -> str:
    return "" if v is None else str(v).strip()


def _pos(v: Any) -> str:
    return _t(v).upper()


def _tipo(v: Any) -> str:
    return _t(v).lower()


def _f(v: Any) -> Optional[float]:
    if v is None or v == "":
        return None
    try:
        return float(v)
    except Exception:
        s = _t(v).replace(",", ".")
        try:
            return float(s)
        except Exception:
            return None


_EXPR_RE = re.compile(r"^(?P<var>[a-zA-Z_][a-zA-Z0-9_]*)\s*\*\s*(?P<num>-?\d+(?:[.,]\d+)?)$")


def _eval_bet_expr(expr: Any, *, ctx: dict[str, float]) -> Optional[float]:
    """
    Accepts:
    - numeric (int/float/str)
    - '<var>*<number>' with ctx variables
    """
    if expr is None or expr == "":
        return None
    if isinstance(expr, (int, float)):
        return float(expr)
    s = _t(expr)
    # numeric string
    f = _f(s)
    if f is not None:
        return float(f)
    m = _EXPR_RE.match(s.replace(" ", ""))
    if not m:
        return None
    var = m.group("var")
    num = float(m.group("num").replace(",", "."))
    base = ctx.get(var)
    if base is None:
        return None
    return float(base) * num


def _match_nullable_text(row_value: str, inp_value: str, *, normalizer) -> bool:
    rv = normalizer(row_value)
    if rv == "":
        return True
    return rv == normalizer(inp_value)


def _match_range(min_v: Optional[float], max_v: Optional[float], x: float) -> bool:
    if min_v is None or max_v is None:
        return True
    return float(min_v) <= float(x) <= float(max_v)


def _specificity(row: sqlite3.Row) -> tuple[int, int, int, int, float, float]:
    p2_tipo = 1 if _t(row["p2_tipo"]) else 0
    p3_tipo = 1 if _t(row["p3_tipo"]) else 0
    pos = 1 if (_t(row["p2_pos"]) or _t(row["p3_pos"])) else 0
    bet = 1 if (row["bet_min"] is not None and row["bet_max"] is not None) else 0
    se_min = float(row["stack_effective_min"] or 0.0)
    se_max = float(row["stack_effective_max"] or 0.0)
    se_width = se_max - se_min
    bet_min = _f(row["bet_min"])
    bet_max = _f(row["bet_max"])
    bet_width = (bet_max - bet_min) if (bet_min is not None and bet_max is not None) else 9999.0
    return (p2_tipo, p3_tipo, pos, bet, -se_width, -bet_width)


def _pick_unique(rows: list[sqlite3.Row], *, what: str) -> sqlite3.Row:
    if len(rows) == 1:
        return rows[0]
    if not rows:
        raise ValueError(f"No {what} matches")
    rows_sorted = sorted(rows, key=_specificity, reverse=True)
    best_score = _specificity(rows_sorted[0])
    best = [r for r in rows_sorted if _specificity(r) == best_score]
    if len(best) == 1:
        return best[0]
    ids = [int(r["id"]) for r in best[:10] if "id" in r.keys()]
    raise ValueError(f"Ambiguous {what}: {len(best)} candidates share top specificity (ids~={ids})")


def _find_unique_scope_sheet(conn: sqlite3.Connection, inp: SpotDecisionInput) -> str:
    cur = conn.cursor()
    cur.execute(
        """
        SELECT *
        FROM spots_strategy_scopes
        WHERE spot_key = ?
          AND scope_se_min <= ?
          AND scope_se_max > ?
        """,
        (_pos(inp.spot_key), float(inp.p1_se_bb), float(inp.p1_se_bb)),
    )
    rows = list(cur.fetchall())
    rows = [
        r
        for r in rows
        if _match_nullable_text(r["p2_tipo"], inp.p2_tipo, normalizer=_tipo)
        and _match_nullable_text(r["p3_tipo"], inp.p3_tipo, normalizer=_tipo)
    ]
    return _pick_unique(rows, what="strategy scope")["sheet_name"]


def _fold_no_strategy_row(sheet: str) -> dict[str, Any]:
    """FOLD with no spots_strategies row id (hand not in any hand_range or invalid hand)."""
    return {"ok": True, "move": "FOLD", "betmin": 0, "betmax": 0, "sheet": sheet}


def decide_spot_strategy(conn: sqlite3.Connection, inp: SpotDecisionInput) -> dict[str, Any]:
    """
    Returns a strategy dict compatible with the worker routing:
      { ok, move, betmin, betmax, spot_strategy_id?, ... }
    """
    sheet = _find_unique_scope_sheet(conn, inp)
    spot_key = _pos(inp.spot_key)
    p2_tipo = _tipo(inp.p2_tipo)
    p3_tipo = _tipo(inp.p3_tipo)
    p2_pos = _pos(inp.p2_pos)
    p3_pos = _pos(inp.p3_pos)

    if sheet.strip().lower() == "nash push fold":
        try:
            hc = normalize_hand_class(inp.hand_class)
        except ValueError:
            return _fold_no_strategy_row(sheet)
        cur = conn.cursor()
        cur.execute(
            """
            SELECT *
            FROM spots_strategies_nash
            WHERE spot_key = ?
              AND hand_class = ?
              AND stack_effective_min <= ?
              AND stack_effective_max > ?
            """,
            (spot_key, hc, float(inp.p1_se_bb), float(inp.p1_se_bb)),
        )
        rows = list(cur.fetchall())
        rows = [
            r
            for r in rows
            if _match_nullable_text(r["p2_tipo"], p2_tipo, normalizer=_tipo)
            and _match_nullable_text(r["p3_tipo"], p3_tipo, normalizer=_tipo)
            and _match_nullable_text(r["p2_pos"], p2_pos, normalizer=_pos)
            and _match_nullable_text(r["p3_pos"], p3_pos, normalizer=_pos)
        ]
        if not rows:
            return _fold_no_strategy_row(sheet)
        row = _pick_unique(rows, what="nash row")
        return {
            "ok": True,
            "move": _t(row["move"]) or "PUSH",
            "betmin": 75,
            "betmax": 75,
            "sheet": sheet,
            "spot_strategy_id": int(row["id"]),
        }

    try:
        hc = normalize_hand_class(inp.hand_class)
    except ValueError:
        return _fold_no_strategy_row(sheet)

    # Hoja1 -> spots_strategies
    cur = conn.cursor()
    cur.execute(
        """
        SELECT *
        FROM spots_strategies
        WHERE spot_key = ?
          AND stack_effective_min <= ?
          AND stack_effective_max > ?
        """,
        (spot_key, float(inp.p1_se_bb), float(inp.p1_se_bb)),
    )
    rows = list(cur.fetchall())
    if not rows:
        raise ValueError("No spots_strategies rows for spot_key+SE")

    # match by categorical + optional bet range
    matched: list[sqlite3.Row] = []
    for r in rows:
        if not _match_nullable_text(r["p2_tipo"], p2_tipo, normalizer=_tipo):
            continue
        if not _match_nullable_text(r["p3_tipo"], p3_tipo, normalizer=_tipo):
            continue
        if not _match_nullable_text(r["p2_pos"], p2_pos, normalizer=_pos):
            continue
        if not _match_nullable_text(r["p3_pos"], p3_pos, normalizer=_pos):
            continue
        if not _match_range(_f(r["p1bet_min"]), _f(r["p1bet_max"]), float(inp.p1_bet_bb)):
            continue
        matched.append(r)

    if not matched:
        raise ValueError("No spots_strategies row matches structure (pos/tipo/bet)")

    matched_hand = [
        r
        for r in matched
        if _t(r["hand_range"]) and hand_in_range(hc, _t(r["hand_range"]))
    ]
    if not matched_hand:
        return _fold_no_strategy_row(sheet)

    row = _pick_unique(matched_hand, what="spots strategy row")
    move = _t(row["move"]).upper() or "FOLD"

    if move == "FOLD":
        return {
            "ok": True,
            "move": "FOLD",
            "betmin": 0,
            "betmax": 0,
            "sheet": sheet,
            "spot_strategy_id": int(row["id"]),
        }

    ctx = {
        "p1_se_bb": float(inp.p1_se_bb),
        "stack_effective_min": float(row["stack_effective_min"]),
        "stack_effective_max": float(row["stack_effective_max"]),
    }
    betmin = _eval_bet_expr(row["bet_min"], ctx=ctx)
    betmax = _eval_bet_expr(row["bet_max"], ctx=ctx)
    # fallback: if not provided, use 0 to keep shape stable (still counts as no_strategy_move)
    if betmin is None:
        betmin = 0.0
    if betmax is None:
        betmax = betmin

    return {
        "ok": True,
        "move": move,
        "betmin": float(betmin),
        "betmax": float(betmax),
        "sheet": sheet,
        "spot_strategy_id": int(row["id"]),
    }

