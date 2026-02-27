# modules/db/repo_obs.py
from __future__ import annotations

from typing import Any, Dict, Optional

from .conn import connect
from .migrate import init_db, now_ms


def insert_obs(
    *,
    fingerprint: str,
    table_id: str = "",
    detected_at_ms: int = 0,
    mano_raw: str = "",
    hand_class: str = "",
    time_str: str = "",
    preflop_ok: bool = False,
    noboard_ok: bool = False,
    ocr_json: str = "",
    p2bet: Optional[float] = None,
    p3bet: Optional[float] = None,
    frame_ref: str = "",
) -> Optional[int]:
    init_db()
    with connect() as conn:
        cur = conn.cursor()
        cur.execute(
            '''
            INSERT OR IGNORE INTO hands_obs
            (fingerprint, table_id, detected_at_ms, mano_raw, hand_class, time_str,
             preflop_ok, noboard_ok, ocr_json, p2bet, p3bet, frame_ref, created_at_ms)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''',
            (
                fingerprint,
                table_id or "",
                int(detected_at_ms) if detected_at_ms else 0,
                mano_raw or "",
                hand_class or "",
                time_str or "",
                1 if preflop_ok else 0,
                1 if noboard_ok else 0,
                ocr_json or "",
                p2bet,
                p3bet,
                frame_ref or "",
                now_ms(),
            ),
        )
        conn.commit()
        cur.execute("SELECT obs_id FROM hands_obs WHERE fingerprint = ?", (fingerprint,))
        row = cur.fetchone()
        return int(row["obs_id"]) if row else None


def get_obs_by_fingerprint(fingerprint: str) -> Optional[Dict[str, Any]]:
    init_db()
    with connect() as conn:
        cur = conn.cursor()
        cur.execute("SELECT * FROM hands_obs WHERE fingerprint = ?", (fingerprint,))
        row = cur.fetchone()
        return dict(row) if row else None
