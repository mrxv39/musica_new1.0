# C:\Users\Usuario\Desktop\proyectos\poker_boss\modules\strategy\substrategy_selector.py
from __future__ import annotations

import argparse
import json
import os
import sqlite3
from typing import Any, Dict, List, Tuple

from modules.db.db import get_conn, init_db
from .range_parser import hand_in_range, normalize_hand_class

from .selector_models import MatchInput, SubStrategySpec
from .selector_utils import as_text, env_truthy, load_payload
from .selector_matching import match_row_strict
from .selector_diagnostics import build_failure_error_message
from .selector_fallback import fallback_nearest_se

OR_KEYS = [
    "OR_TO_CALL_ANY",
    "OPEN_PUSH",
    "OR_TO_CALL_SMALL",
    "OR_TO_FOLD",
    "LIMP_CALL_ANY",
    "LIMP_CALL_SMALL",
    "LIMP_FOLD",
    "LIMP_TO_CALL_ANY",
]

# MOVE mapping (as per requested contract):
# - OR_* keys => move "OR"
# - OPEN_PUSH => move "PUSH"
# - LIMP_* keys => move "LIMP"
OR_BLOCK_MOVE_BY_KEY = {
    "OR_TO_CALL_ANY": "OR",
    "OR_TO_CALL_SMALL": "OR",
    "OR_TO_FOLD": "OR",
    "OPEN_PUSH": "PUSH",
    "LIMP_CALL_ANY": "LIMP",
    "LIMP_CALL_SMALL": "LIMP",
    "LIMP_FOLD": "LIMP",
    "LIMP_TO_CALL_ANY": "LIMP",
}


# -----------------------------
# Decision logic (ranges)
# -----------------------------

def _decide_move(payload: Dict[str, Any], hand_class: str) -> Dict[str, Any]:
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


# -----------------------------
# DB access
# -----------------------------

def _fetch_rows(conn: sqlite3.Connection) -> List[sqlite3.Row]:
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
    rows = _fetch_rows(conn)
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


def select_move(inp: MatchInput) -> Dict[str, Any]:
    init_db()
    conn = get_conn()
    try:
        row, payload = find_unique_substrategy(conn, inp)
        decision = _decide_move(payload, inp.hand_class)

        out = {
            "sub_strategy_id": int(row["id"]),
            "sub_strategy_name": str(row["name"]),
            "situation_key": str(row["situation_key"]),  # <- from spots.name via spot_id
            "requested_situacion": (inp.situacion or ""),
            **decision,
        }

        note = payload.get("_match_note") if isinstance(payload, dict) else None
        if note:
            out["match_note"] = str(note)

        return out
    finally:
        conn.close()


def _parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Select move from sub_strategies (STRICT)")
    p.add_argument("--json", default="", help="Path to JSON with MatchInput fields")

    p.add_argument("--situacion", default="")
    p.add_argument("--spot", default="")
    p.add_argument("--hero_pos", default="")
    p.add_argument("--hand", default="")

    p.add_argument("--p1_bet", type=float, default=0)
    p.add_argument("--p1_stack", type=float, default=0)
    p.add_argument("--p1_se", type=float, default=0)

    p.add_argument("--p2_pos", default="")
    p.add_argument("--p2_tipo", default="")
    p.add_argument("--p2_bet", type=float, default=0)
    p.add_argument("--p2_stack", type=float, default=0)

    p.add_argument("--p3_pos", default="")
    p.add_argument("--p3_tipo", default="")
    p.add_argument("--p3_bet", type=float, default=0)
    p.add_argument("--p3_stack", type=float, default=0)

    p.add_argument("--fallback_se", action="store_true", help="Enable fallback nearest SE for this run.")
    return p.parse_args()


def main() -> int:
    ns = _parse_args()

    if ns.fallback_se:
        os.environ["POKER_BOSS_FALLBACK_SE"] = "1"

    if ns.json:
        with open(ns.json, "r", encoding="utf-8") as f:
            data = json.load(f)
    else:
        data = {
            "situacion": ns.situacion,
            "spot": ns.spot,
            "hero_pos": ns.hero_pos,
            "hand_class": ns.hand,
            "p1_bet_bb": ns.p1_bet,
            "p1_stack_bb": ns.p1_stack,
            "p1_se_bb": ns.p1_se,
            "p2_pos": ns.p2_pos,
            "p2_tipo": ns.p2_tipo,
            "p2_bet_bb": ns.p2_bet,
            "p2_stack_bb": ns.p2_stack,
            "p3_pos": ns.p3_pos,
            "p3_tipo": ns.p3_tipo,
            "p3_bet_bb": ns.p3_bet,
            "p3_stack_bb": ns.p3_stack,
        }

    inp = MatchInput(**data)
    out = select_move(inp)
    print(json.dumps(out, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())