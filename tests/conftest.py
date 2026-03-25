# tests/conftest.py
"""
Global test fixture: every test session uses an isolated temporary DB
so that tests never touch the production poker_boss.db.

Tests that already set MUSICA_DB_PATH in their own setUp will simply
overwrite this value — no conflict.
"""
import os
import tempfile

import pytest


@pytest.fixture(autouse=True)
def _isolate_db(tmp_path):
    """Point the DB env var at a fresh temp file for every test."""
    db_path = str(tmp_path / "test_poker_boss.db")
    old = os.environ.get("MUSICA_DB_PATH")
    os.environ["MUSICA_DB_PATH"] = db_path
    yield
    if old is None:
        os.environ.pop("MUSICA_DB_PATH", None)
    else:
        os.environ["MUSICA_DB_PATH"] = old
