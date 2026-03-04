# C:\Users\Usuario\Desktop\proyectos\poker_boss\modules\strategy\substrategy_selector.py
from __future__ import annotations

import argparse
import json
import os
from typing import Any, Dict

from modules.db.db import get_conn, init_db

from .selector_models import MatchInput
from .substrategy_repo import find_unique_substrategy
from .substrategy_decide import decide_move


def select_move(inp: MatchInput) -> Dict[str, Any]:
    init_db()
    conn = get_conn()
    try:
        row, payload = find_unique_substrategy(conn, inp)
        decision = decide_move(payload, inp.hand_class)

        out: Dict[str, Any] = {
            "sub_strategy_id": int(row["id"]),
            "sub_strategy_name": str(row["name"]),
            "situation_key": str(row["situation_key"]),
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
