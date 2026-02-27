# modules/db/conn.py
from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from typing import Iterator

from .paths import get_db_path


def get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(get_db_path(), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


@contextmanager
def connect() -> Iterator[sqlite3.Connection]:
    conn = get_conn()
    try:
        yield conn
    finally:
        conn.close()
