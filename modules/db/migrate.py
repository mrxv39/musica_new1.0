from __future__ import annotations

import threading

from .conn import connect
from .migrate_specs import (
    HANDS_COLUMNS,
    HANDS_OBS_COLUMNS,
    HANDS_REAL_COLUMNS,
    INDEX_SQLS,
    TOURNAMENTS_COLUMNS,
    WORKERS_CAPTURES_COLUMNS,
)
from .migrate_utils import apply_columns, now_ms, table_exists
from .schema import SCHEMA_TABLES_SQL

_LOCK = threading.Lock()


def _create_indexes(conn) -> None:
    cur = conn.cursor()
    for sql in INDEX_SQLS:
        cur.execute(sql)


def init_db() -> None:
    # Thread-safe, idempotent initializer (schema + lightweight migrations + indexes)
    with _LOCK:
        with connect() as conn:
            conn.executescript(SCHEMA_TABLES_SQL)

            apply_columns(conn, "hands", HANDS_COLUMNS)
            apply_columns(conn, "hands_obs", HANDS_OBS_COLUMNS)
            apply_columns(conn, "tournaments", TOURNAMENTS_COLUMNS)
            apply_columns(conn, "workers_captures", WORKERS_CAPTURES_COLUMNS)
            if table_exists(conn, "hands_real"):
                apply_columns(conn, "hands_real", HANDS_REAL_COLUMNS)
                conn.execute(
                    "CREATE INDEX IF NOT EXISTS idx_hands_real_tournament_id ON hands_real(tournament_id)"
                )

            _create_indexes(conn)
            conn.commit()
