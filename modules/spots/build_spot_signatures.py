# C:\Users\Usuario\Desktop\proyectos\poker_boss\modules\spots\build_spot_signatures.py
from __future__ import annotations

import os
import sys

# Ensure repo root is on sys.path when running as a script: python modules/spots/build_spot_signatures.py ...
_REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if _REPO_ROOT not in sys.path:
    sys.path.insert(0, _REPO_ROOT)

import argparse
import sqlite3
from typing import Any, Dict, Iterable, List, Tuple

from modules.spots.spot_signature import build_signature_from_spot_row


def _ensure_table(conn: sqlite3.Connection) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS spot_signatures (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            signature TEXT UNIQUE,
            street TEXT,
            hero_position TEXT,
            players TEXT,
            se_bucket TEXT,
            occurrences INTEGER DEFAULT 0
        );
        """
    )
    conn.commit()


def _iter_spots(conn: sqlite3.Connection, limit: int = 0) -> Iterable[sqlite3.Row]:
    sql = "SELECT * FROM spots_real"
    params: tuple[int, ...] = ()
    if limit and limit > 0:
        sql += " LIMIT ?"
        params = (int(limit),)
    cur = conn.execute(sql, params)
    for row in cur.fetchall():
        yield row


def _upsert_signature(conn: sqlite3.Connection, sig: str, street: str, hero_pos: str, players: str, se_bucket: str) -> None:
    conn.execute(
        """
        INSERT INTO spot_signatures(signature, street, hero_position, players, se_bucket, occurrences)
        VALUES (?, ?, ?, ?, ?, 1)
        ON CONFLICT(signature) DO UPDATE SET occurrences = occurrences + 1;
        """,
        (sig, street, hero_pos, players, se_bucket),
    )


def build(db_path: str, limit: int = 0, verbose: bool = False) -> Dict[str, Any]:
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row

    _ensure_table(conn)

    total = 0
    try:
        for row in _iter_spots(conn, limit=limit):
            d = dict(row)
            ss = build_signature_from_spot_row(d)
            _upsert_signature(conn, ss.signature, ss.street, ss.hero_pos, ss.players, ss.se_bucket)
            total += 1
            if verbose and total % 500 == 0:
                print(f"[spot_signatures] processed={total}")
        conn.commit()
    finally:
        conn.close()

    return {"ok": True, "db": db_path, "spots_processed": total}


def top(db_path: str, n: int = 30) -> List[Tuple[str, int]]:
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    try:
        cur = conn.execute(
            """
            SELECT signature, occurrences
            FROM spot_signatures
            ORDER BY occurrences DESC, signature ASC
            LIMIT ?;
            """,
            (int(n),),
        )
        rows = cur.fetchall()
        return [(str(r["signature"]), int(r["occurrences"])) for r in rows]
    finally:
        conn.close()


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--db", required=True)
    p.add_argument("--limit", type=int, default=0, help="Procesar solo N spots (debug). 0 = todos")
    p.add_argument("--top", type=int, default=30, help="Mostrar top N")
    p.add_argument("--verbose", action="store_true")
    args = p.parse_args()

    res = build(db_path=args.db, limit=args.limit, verbose=args.verbose)
    print(res)

    tops = top(db_path=args.db, n=args.top)
    print("\n=== TOP SPOT SIGNATURES ===")
    for sig, occ in tops:
        print(f"{occ:>6}  {sig}")


if __name__ == "__main__":
    main()
