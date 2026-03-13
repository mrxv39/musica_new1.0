import json
import os
import sqlite3
from pathlib import Path

import pytest


@pytest.fixture(autouse=True)
def isolated_db_env(monkeypatch, tmp_path):
    db_path = tmp_path / "test_poker_boss.db"
    monkeypatch.setenv("POKER_BOSS_DB_PATH", str(db_path))

    # Reset cached global connection/path if module already loaded
    try:
        import modules.db.db as dbmod
        try:
            if getattr(dbmod, "_DB_CONN", None) is not None:
                dbmod._DB_CONN.close()
        except Exception:
            pass
        dbmod._DB_CONN = None
        dbmod._DB_PATH_ACTIVE = None
    except Exception:
        pass

    yield db_path

    try:
        import modules.db.db as dbmod
        try:
            if getattr(dbmod, "_DB_CONN", None) is not None:
                dbmod._DB_CONN.close()
        except Exception:
            pass
        dbmod._DB_CONN = None
        dbmod._DB_PATH_ACTIVE = None
    except Exception:
        pass


@pytest.fixture
def temp_db_path(isolated_db_env) -> Path:
    return isolated_db_env


@pytest.fixture
def initialized_db(temp_db_path):
    from modules.db.migrate import init_db
    init_db()
    return temp_db_path


@pytest.fixture
def sample_ocr_payload():
    return {
        "ok": True,
        "errors": [],
        "names": {
            "ok": True,
            "p2_name": "VillanoA",
            "p3_name": "VillanoB",
            "roi": {"p2": [70, 180, 120, 18], "p3": [645, 180, 120, 18]},
            "errors": [],
        },
        "villano": {
            "ok": True,
            "p2": {"name": "VillanoA", "tipo": "fish"},
            "p3": {"name": "VillanoB", "tipo": "reg"},
            "created": [],
            "errors": [],
        },
        "stackefectivo": {
            "ok": True,
            "value": 15.0,
            "raw_text": "15.",
            "roi": [265, 472, 72, 42],
            "method": "otsu",
            "error": "",
        },
        "bets": {
            "ok": True,
            "p1": 0.0,
            "p2": 0.5,
            "p3": 1.0,
            "raw": {"p1": "", "p2": "0.5", "p3": "1"},
            "method": {"p1": "", "p2": "otsu", "p3": "otsu"},
            "errors": [],
        },
        "stacks": {
            "ok": True,
            "p1": 15.0,
            "p2": 20.0,
            "p3": 18.0,
            "raw": {"p1": "15", "p2": "20", "p3": "18"},
            "method": {"p1": "otsu", "p2": "otsu", "p3": "otsu"},
            "errors": [],
        },
        "table_state": {
            "ok": True,
            "players": 3,
            "is_hu": False,
            "is_3h": True,
            "active_seats": ["p1", "p2", "p3"],
            "eliminated_seats": [],
            "method": "names_empty_and_stack_null",
            "errors": [],
        },
        "dealer": {
            "ok": True,
            "dealer_seat": "p1",
            "score": 0.93,
            "method": "template_match_fullframe_nearest_seat",
            "errors": [],
            "debug": {},
        },
        "posiciones": {
            "ok": True,
            "p1": "BTN",
            "p2": "SB",
            "p3": "BB",
            "btn_seat": "p1",
            "sb_seat": "p2",
            "bb_seat": "p3",
            "dealer_seat": "p1",
            "method": "dealer_button",
            "errors": [],
            "debug": {},
        },
    }


def table_columns(db_path, table_name):
    conn = sqlite3.connect(str(db_path))
    try:
        rows = conn.execute(f"PRAGMA table_info({table_name})").fetchall()
        return [r[1] for r in rows]
    finally:
        conn.close()


def index_names(db_path):
    conn = sqlite3.connect(str(db_path))
    try:
        rows = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='index' ORDER BY name"
        ).fetchall()
        return [r[0] for r in rows]
    finally:
        conn.close()


def fetch_one(db_path, sql, params=()):
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    try:
        row = conn.execute(sql, params).fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def fetch_all(db_path, sql, params=()):
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    try:
        rows = conn.execute(sql, params).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()
