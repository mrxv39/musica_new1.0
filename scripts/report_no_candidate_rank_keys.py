#!/usr/bin/env python3
from __future__ import annotations

import argparse
import os
import sqlite3
import sys

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from modules.preflop.link_hands_obs_to_real import DEFAULT_DB, rank_key_obs, rank_key_real


def _value_text(value: object) -> str:
    if value is None:
        return "None"
    return str(value)


def main() -> int:
    ap = argparse.ArgumentParser(
        description=(
            "Diagnostica observaciones sin link y comprueba si su rank_key canónico "
            "existe en hands."
        )
    )
    ap.add_argument("--db", default=DEFAULT_DB)
    args = ap.parse_args()

    con = sqlite3.connect(args.db)
    con.row_factory = sqlite3.Row
    try:
        cur = con.cursor()

        obs_rows = cur.execute(
            """
            SELECT ho.obs_id AS spot_id, ho.mano_raw
            FROM spots ho
            WHERE ho.hand_id IS NULL
            ORDER BY ho.obs_id ASC
            """
        ).fetchall()

        real_rows = cur.execute(
            """
            SELECT id, hero_cards
            FROM hands
            WHERE TRIM(COALESCE(hero_cards, '')) <> ''
            ORDER BY id ASC
            """
        ).fetchall()
    finally:
        con.close()

    real_rank_keys = set()
    for row in real_rows:
        rkey = rank_key_real(row["hero_cards"])
        if rkey is not None:
            real_rank_keys.add(rkey)

    total = 0
    exists_count = 0
    missing_count = 0

    for row in obs_rows:
        total += 1
        mano_raw = row["mano_raw"]
        obs_rkey = rank_key_obs(mano_raw)
        exists_in_real = obs_rkey is not None and obs_rkey in real_rank_keys
        if exists_in_real:
            exists_count += 1
        else:
            missing_count += 1

        print(
            f"spot_id={row['spot_id']} "
            f"mano_raw={_value_text(mano_raw)} "
            f"rank_key={_value_text(obs_rkey)} "
            f"exists_in_real={'yes' if exists_in_real else 'no'}"
        )

    print()
    print(
        f"no_candidate total: {total}, "
        f"rank_key exists in hands: {exists_count}, "
        f"rank_key missing in hands: {missing_count}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
