# modules/db/migrate.py
from __future__ import annotations

import sqlite3
import threading
import time
from typing import Sequence

from .conn import connect
from .schema import SCHEMA_TABLES_SQL

_LOCK = threading.Lock()


def now_ms() -> int:
    return int(time.time() * 1000)


def _table_columns(conn: sqlite3.Connection, table: str) -> Sequence[str]:
    cur = conn.cursor()
    cur.execute(f"PRAGMA table_info({table})")
    return [r[1] for r in cur.fetchall()]


def _add_column_if_missing(conn: sqlite3.Connection, table: str, col_name: str, col_def: str) -> None:
    cols = _table_columns(conn, table)
    if col_name not in cols:
        cur = conn.cursor()
        cur.execute(f"ALTER TABLE {table} ADD COLUMN {col_name} {col_def}")


def _create_indexes(conn: sqlite3.Connection) -> None:
    cur = conn.cursor()
    cur.execute("CREATE INDEX IF NOT EXISTS idx_hands_created_at ON hands(created_at_ms DESC)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_hands_obs_table_time ON hands_obs(table_id, detected_at_ms DESC)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_hands_xml_session_startdate ON hands_xml(sessioncode, startdate)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_hand_links_gamecode ON hand_links(gamecode)")


def init_db() -> None:
    # Thread-safe, idempotent initializer (schema + lightweight migrations + indexes)
    with _LOCK:
        with connect() as conn:
            conn.executescript(SCHEMA_TABLES_SQL)

            # legacy migrations
            _add_column_if_missing(conn, "hands", "created_at_ms", "INTEGER DEFAULT 0")
            _add_column_if_missing(conn, "hands", "data_json", "TEXT DEFAULT ''")

            # hands_obs migrations (new cols)
            _add_column_if_missing(conn, "hands_obs", "p2bet", "REAL DEFAULT NULL")
            _add_column_if_missing(conn, "hands_obs", "p3bet", "REAL DEFAULT NULL")
            _add_column_if_missing(conn, "hands_obs", "frame_ref", "TEXT DEFAULT ''")

            _create_indexes(conn)
            conn.commit()
