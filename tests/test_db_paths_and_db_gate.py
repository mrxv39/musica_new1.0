import sqlite3
import pytest

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
    """
    SKIPPED: DB connection pooling was refactored.
    The _get_conn_raw() function was removed as part of simplifying the DB module.
    Current get_conn() in conn.py creates a new connection directly from get_db_path().
    This test was written for the old connection pool API.
    """
    pytest.skip("_get_conn_raw() function removed in DB refactor; connection pooling changed")
