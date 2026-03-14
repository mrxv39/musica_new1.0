import sqlite3

import modules.db.db as dbmod
from modules.db.config import DBConfig, get_db_path_from_env
from modules.db.paths import data_dir, get_db_path, project_root


def test_get_db_path_from_env_prefers_new_var(monkeypatch):
    monkeypatch.setenv("POKER_BOSS_DB_PATH", "new.sqlite")
    monkeypatch.setenv("MUSICA_DB_PATH", "legacy.sqlite")

    assert get_db_path_from_env(DBConfig()) == "new.sqlite"


def test_get_db_path_from_env_returns_none_when_blank(monkeypatch):
    monkeypatch.delenv("POKER_BOSS_DB_PATH", raising=False)
    monkeypatch.setenv("MUSICA_DB_PATH", "   ")

    assert get_db_path_from_env(DBConfig()) is None


def test_project_root_and_data_dir(tmp_path):
    root = project_root()

    assert root.endswith("poker_boss")

    created = data_dir(str(tmp_path))
    assert created == str(tmp_path / "data")
    assert (tmp_path / "data").is_dir()


def test_get_db_path_uses_env_override(monkeypatch):
    monkeypatch.setenv("POKER_BOSS_DB_PATH", "override.sqlite")

    assert get_db_path() == "override.sqlite"


def test_get_db_path_uses_default_filename_when_env_missing(monkeypatch, tmp_path):
    monkeypatch.delenv("POKER_BOSS_DB_PATH", raising=False)
    monkeypatch.delenv("MUSICA_DB_PATH", raising=False)
    monkeypatch.setattr("modules.db.paths.project_root", lambda: str(tmp_path))

    assert get_db_path().endswith("data\\poker_boss.db")


def test_get_conn_reuses_current_path_and_closes_previous_on_switch(monkeypatch):
    original_conn = dbmod._DB_CONN
    original_active = dbmod._DB_PATH_ACTIVE
    original_get_conn_raw = dbmod._get_conn_raw
    try:
        closed = {"count": 0}

        class DummyConn:
            def close(self):
                closed["count"] += 1

        calls = {"init_db": 0, "get_conn_raw": 0}
        current_path = {"value": "first.sqlite"}

        monkeypatch.setattr(dbmod, "get_db_path", lambda: current_path["value"])
        monkeypatch.setattr(dbmod, "init_db", lambda: calls.__setitem__("init_db", calls["init_db"] + 1))

        def fake_get_conn_raw():
            calls["get_conn_raw"] += 1
            return sqlite3.connect(":memory:")

        monkeypatch.setattr(dbmod, "_get_conn_raw", fake_get_conn_raw)
        dbmod._DB_CONN = DummyConn()
        dbmod._DB_PATH_ACTIVE = "first.sqlite"

        conn1 = dbmod.get_conn()
        assert isinstance(conn1, sqlite3.Connection)
        conn1.close()
        assert closed["count"] == 0

        current_path["value"] = "second.sqlite"
        conn2 = dbmod.get_conn()
        assert isinstance(conn2, sqlite3.Connection)
        conn2.close()

        assert closed["count"] == 1
        assert calls["init_db"] == 2
        assert calls["get_conn_raw"] == 2
        assert dbmod._DB_PATH_ACTIVE == "second.sqlite"
    finally:
        dbmod._DB_CONN = original_conn
        dbmod._DB_PATH_ACTIVE = original_active
        dbmod._get_conn_raw = original_get_conn_raw
