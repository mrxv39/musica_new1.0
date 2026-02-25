# C:\Users\Usuario\Desktop\proyectos\poker_boss\modules\strategy\substrategy_selector.py

from __future__ import annotations

import argparse
import json
import sqlite3
from dataclasses import dataclass
from typing import Any, Dict, List, Tuple, Optional

from modules.db.db import get_conn, init_db
from .range_parser import hand_in_range, normalize_hand_class

OR_KEYS = ["OR_TO_CALL_ANY", "OPEN_PUSH", "OR_TO_CALL_SMALL", "OR_TO_FOLD"]


@dataclass(frozen=True)
class MatchInput:
    spot: str
    hero_pos: str

    p1_bet_bb: float
    p1_stack_bb: float
    p1_se_bb: float

    p2_pos: str
    p2_tipo: str
    p2_bet_bb: float
    p2_stack_bb: float

    p3_pos: str
    p3_tipo: str
    p3_bet_bb: float
    p3_stack_bb: float

    hand_class: str
    situacion: str  # NOT used for filtering in strict mode (only for debug/context)


def _as_text(v: Any) -> str:
    if v is None:
        return ""
    return str(v)


def _req_str(payload: Dict[str, Any], key: str) -> str:
    """Required string field: must exist and be non-empty after strip."""
    v = payload.get(key, None)
    s = _as_text(v).strip()
    if not s:
        raise ValueError(f"payload missing/empty required field '{key}'")
    return s


def _req_float(payload: Dict[str, Any], key: str) -> float:
    """Required numeric field: must exist and parse to float."""
    v = payload.get(key, None)
    if v is None or (isinstance(v, str) and not v.strip()):
        raise ValueError(f"payload missing required numeric field '{key}'")
    try:
        return float(v)
    except Exception:
        raise ValueError(f"payload invalid numeric field '{key}': {v!r}")


def _between(x: float, lo: float, hi: float) -> bool:
    return float(lo) <= float(x) <= float(hi)


def _load_payload(row: sqlite3.Row) -> Dict[str, Any]:
    try:
        return json.loads(row["payload_json"] or "{}")
    except Exception:
        return {}


def _row_matches_strict(inp: MatchInput, row: sqlite3.Row) -> Tuple[bool, str]:
    """
    STRICT MATCHING:
    - No wildcards.
    - Any missing/None/empty required field => row does NOT match.
    - Numeric min/max MUST exist (no None). If you want open ranges, define them explicitly.
    """
    payload = _load_payload(row)
    try:
        # Required fields (strings)
        spot = _req_str(payload, "spot").upper()
        hero_pos = _req_str(payload, "hero_pos").upper()
        p2_pos = _req_str(payload, "p2_pos").upper()
        p3_pos = _req_str(payload, "p3_pos").upper()
        p2_tipo = _req_str(payload, "p2_tipo").lower()
        p3_tipo = _req_str(payload, "p3_tipo").lower()

        if spot != (inp.spot or "").strip().upper():
            return False, "spot"
        if hero_pos != (inp.hero_pos or "").strip().upper():
            return False, "hero_pos"
        if p2_pos != (inp.p2_pos or "").strip().upper():
            return False, "p2_pos"
        if p3_pos != (inp.p3_pos or "").strip().upper():
            return False, "p3_pos"
        if p2_tipo != (inp.p2_tipo or "").strip().lower():
            return False, "p2_tipo"
        if p3_tipo != (inp.p3_tipo or "").strip().lower():
            return False, "p3_tipo"

        # Required numeric bounds (min/max)
        p1_bet_min = _req_float(payload, "p1_bet_min")
        p1_bet_max = _req_float(payload, "p1_bet_max")
        p1_stack_min = _req_float(payload, "p1_stack_min")
        p1_stack_max = _req_float(payload, "p1_stack_max")
        p1_se_min = _req_float(payload, "p1_se_min")
        p1_se_max = _req_float(payload, "p1_se_max")

        p2_bet_min = _req_float(payload, "p2_bet_min")
        p2_bet_max = _req_float(payload, "p2_bet_max")
        p2_stack_min = _req_float(payload, "p2_stack_min")
        p2_stack_max = _req_float(payload, "p2_stack_max")

        p3_bet_min = _req_float(payload, "p3_bet_min")
        p3_bet_max = _req_float(payload, "p3_bet_max")
        p3_stack_min = _req_float(payload, "p3_stack_min")
        p3_stack_max = _req_float(payload, "p3_stack_max")

        # Apply numeric filters
        if not _between(inp.p1_bet_bb, p1_bet_min, p1_bet_max):
            return False, "p1_bet"
        if not _between(inp.p1_stack_bb, p1_stack_min, p1_stack_max):
            return False, "p1_stack"
        if not _between(inp.p1_se_bb, p1_se_min, p1_se_max):
            return False, "p1_se"

        if not _between(inp.p2_bet_bb, p2_bet_min, p2_bet_max):
            return False, "p2_bet"
        if not _between(inp.p2_stack_bb, p2_stack_min, p2_stack_max):
            return False, "p2_stack"

        if not _between(inp.p3_bet_bb, p3_bet_min, p3_bet_max):
            return False, "p3_bet"
        if not _between(inp.p3_stack_bb, p3_stack_min, p3_stack_max):
            return False, "p3_stack"

        return True, "ok"

    except ValueError as e:
        # Treat malformed payload as non-match with explicit reason
        return False, f"invalid_payload:{e}"


def _decide_move(payload: Dict[str, Any], hand_class: str) -> Dict[str, Any]:
    hc = normalize_hand_class(hand_class)
    or_ranges = payload.get("orRanges") or payload.get("or_ranges") or {}
    plan = payload.get("orRangesPlan") or {}

    matched_keys: List[str] = []
    for k in OR_KEYS:
        rng = ""
        if isinstance(or_ranges, dict):
            rng = _as_text(or_ranges.get(k, "") or "")
        if rng and hand_in_range(hc, rng):
            matched_keys.append(k)

    if len(matched_keys) > 1:
        raise ValueError(f"Hand {hc} matches multiple OR ranges: {matched_keys}")

    key = matched_keys[0] if matched_keys else "OR_TO_FOLD"
    p = plan.get(key) if isinstance(plan, dict) else None
    if not isinstance(p, dict):
        p = {}

    move = str(p.get("move", "OR"))
    bet_min = float(p.get("bet_min_bb", 0) or 0)
    bet_max = float(p.get("bet_max_bb", 0) or 0)

    return {"range_key": key, "move": move, "bet_min_bb": bet_min, "bet_max_bb": bet_max}


def _fetch_rows(conn: sqlite3.Connection) -> List[sqlite3.Row]:
    cur = conn.cursor()
    cur.execute(
        """
        SELECT ss.*, s.key AS situation_key
        FROM sub_strategies ss
        JOIN situations s ON s.id = ss.situation_id
        """
    )
    return cur.fetchall()


def find_unique_substrategy(conn: sqlite3.Connection, inp: MatchInput) -> Tuple[sqlite3.Row, Dict[str, Any]]:
    rows = _fetch_rows(conn)
    if not rows:
        raise ValueError("No sub_strategies rows in database")

    matches: List[Tuple[sqlite3.Row, Dict[str, Any]]] = []
    reasons: Dict[str, int] = {}

    for r in rows:
        ok, reason = _row_matches_strict(inp, r)
        if ok:
            matches.append((r, _load_payload(r)))
        else:
            reasons[reason] = reasons.get(reason, 0) + 1

    if len(matches) != 1:
        ids = [int(m[0]["id"]) for m in matches]
        keys = [str(m[0]["situation_key"]) for m in matches]
        # include top reasons for debugging without spamming
        top_reasons = sorted(reasons.items(), key=lambda kv: kv[1], reverse=True)[:10]
        raise ValueError(
            f"Expected exactly 1 match, got {len(matches)}. matched_ids={ids}. matched_situations={keys}. "
            f"top_nonmatch_reasons={top_reasons}. requested_situacion={inp.situacion!r}"
        )

    row, payload = matches[0]
    return row, payload


def select_move(inp: MatchInput) -> Dict[str, Any]:
    init_db()
    conn = get_conn()
    try:
        row, payload = find_unique_substrategy(conn, inp)
        decision = _decide_move(payload, inp.hand_class)
        return {
            "sub_strategy_id": int(row["id"]),
            "sub_strategy_name": str(row["name"]),
            "situation_key": str(row["situation_key"]),
            "requested_situacion": (inp.situacion or ""),
            **decision,
        }
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
    return p.parse_args()


def main() -> int:
    ns = _parse_args()
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