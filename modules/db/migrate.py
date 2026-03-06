from __future__ import annotations

import threading

from .conn import connect
from .migrate_specs import HANDS_COLUMNS, HANDS_OBS_COLUMNS, INDEX_SQLS, WORKERS_CAPTURES_COLUMNS
from .migrate_utils import apply_columns, now_ms
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
            apply_columns(conn, "workers_captures", WORKERS_CAPTURES_COLUMNS)

            _create_indexes(conn)
            conn.commit()
