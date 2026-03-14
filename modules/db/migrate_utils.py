from __future__ import annotations

import sqlite3
import time
from typing import Sequence


def now_ms() -> int:
    return int(time.time() * 1000)


def table_columns(conn: sqlite3.Connection, table: str) -> Sequence[str]:
    cur = conn.cursor()
    cur.execute(f"PRAGMA table_info({table})")
    return [r[1] for r in cur.fetchall()]


def table_exists(conn: sqlite3.Connection, table: str) -> bool:
    cur = conn.cursor()
    cur.execute(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name=? LIMIT 1",
        (table,),
    )
    return cur.fetchone() is not None


def add_column_if_missing(conn: sqlite3.Connection, table: str, col_name: str, col_def: str) -> None:
    cols = table_columns(conn, table)
    if col_name not in cols:
        cur = conn.cursor()
        cur.execute(f"ALTER TABLE {table} ADD COLUMN {col_name} {col_def}")


def apply_columns(conn: sqlite3.Connection, table: str, columns: Sequence[tuple[str, str]]) -> None:
    for col_name, col_def in columns:
        add_column_if_missing(conn, table, col_name, col_def)
