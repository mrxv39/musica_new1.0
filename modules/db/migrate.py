from __future__ import annotations

import threading

from .conn import connect
from .migrate_specs import (
    INDEX_SQLS,
    SPOTS_COLUMNS,
)
from .migrate_utils import apply_columns, now_ms, table_exists
from .schema import SCHEMA_TABLES_SQL

_LOCK = threading.Lock()


def _create_indexes(conn) -> None:
    cur = conn.cursor()
    for sql in INDEX_SQLS:
        cur.execute(sql)


def init_db() -> None:
    with _LOCK:
        with connect() as conn:
            conn.executescript(SCHEMA_TABLES_SQL)
            apply_columns(conn, "spots", SPOTS_COLUMNS)
            _create_indexes(conn)
            conn.commit()
