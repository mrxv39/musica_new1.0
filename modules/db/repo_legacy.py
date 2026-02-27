# modules/db/repo_legacy.py
from __future__ import annotations

from typing import Any, Dict, Optional

from .conn import connect
from .migrate import init_db, now_ms


def insert_hand(fingerprint: str, data_json: str) -> Optional[int]:
    init_db()
    with connect() as conn:
        cur = conn.cursor()
        cur.execute(
            '''
            INSERT OR IGNORE INTO hands (fingerprint, data_json, created_at_ms)
            VALUES (?, ?, ?)
            ''',
            (fingerprint, data_json or "", now_ms()),
        )
        conn.commit()
        cur.execute("SELECT id FROM hands WHERE fingerprint = ?", (fingerprint,))
        row = cur.fetchone()
        return int(row["id"]) if row else None


def get_hand_by_fingerprint(fingerprint: str) -> Optional[Dict[str, Any]]:
    init_db()
    with connect() as conn:
        cur = conn.cursor()
        cur.execute("SELECT * FROM hands WHERE fingerprint = ?", (fingerprint,))
        row = cur.fetchone()
        return dict(row) if row else None
