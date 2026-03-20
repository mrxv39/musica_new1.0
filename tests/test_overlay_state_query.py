"""Tests for the SQL query used by get_mesas_overlay_state (obs.rs).

We replicate the exact SQL from the Rust command against an in-memory SQLite
database to verify json_extract, ordering, and player update logic.
"""

from __future__ import annotations

import json
import sqlite3

import pytest

from modules.db.schema import SCHEMA_TABLES_SQL

# ---------------------------------------------------------------------------
# The exact SQL from src-tauri/src/obs.rs :: get_mesas_overlay_state
# ---------------------------------------------------------------------------

OVERLAY_SQL = """
SELECT detected_at_ms, preflop_ok, frame_ref, hand_class,
       json_extract(ocr_json, '$.strategy.move') as strategy_move,
       json_extract(ocr_json, '$.strategy.betmin') as strategy_betmin,
       json_extract(ocr_json, '$.strategy.betmax') as strategy_betmax,
       json_extract(ocr_json, '$.ocr.villano.p2.tipo') as p2_tipo,
       json_extract(ocr_json, '$.ocr.villano.p3.tipo') as p3_tipo,
       json_extract(ocr_json, '$.ocr.villano.p2.name') as p2_name,
       json_extract(ocr_json, '$.ocr.villano.p3.name') as p3_name
FROM spots
WHERE table_id = ?
ORDER BY detected_at_ms DESC, obs_id DESC
LIMIT 1
"""


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def conn():
    c = sqlite3.connect(":memory:")
    c.row_factory = sqlite3.Row
    c.executescript(SCHEMA_TABLES_SQL)
    yield c
    c.close()


def _insert_spot(conn, *, table_id="mesa_1", detected_at_ms=1000,
                 preflop_ok=1, frame_ref="frame.bmp", hand_class="AKs",
                 ocr_json="{}"):
    conn.execute(
        """INSERT INTO spots
           (fingerprint, table_id, detected_at_ms, preflop_ok, frame_ref,
            hand_class, ocr_json)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (f"fp_{table_id}_{detected_at_ms}", table_id, detected_at_ms,
         preflop_ok, frame_ref, hand_class, ocr_json),
    )
    conn.commit()


def _query_overlay(conn, table_id="mesa_1"):
    """Run the overlay query and return a dict or None."""
    row = conn.execute(OVERLAY_SQL, (table_id,)).fetchone()
    return dict(row) if row else None


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestOverlayStrategyFields:
    """json_extract correctly pulls strategy.move / betmin / betmax."""

    def test_overlay_returns_strategy_fields(self, conn):
        ocr = {
            "strategy": {"move": "RAISE", "betmin": 2.5, "betmax": 3.0},
            "ocr": {},
        }
        _insert_spot(conn, table_id="mesa_1", ocr_json=json.dumps(ocr))

        row = _query_overlay(conn, "mesa_1")

        assert row is not None
        assert row["strategy_move"] == "RAISE"
        assert row["strategy_betmin"] == 2.5
        assert row["strategy_betmax"] == 3.0

    def test_strategy_move_empty_string(self, conn):
        """Empty strategy.move should still come back as empty string."""
        ocr = {"strategy": {"move": "", "betmin": 0, "betmax": 0}}
        _insert_spot(conn, table_id="mesa_1", ocr_json=json.dumps(ocr))

        row = _query_overlay(conn, "mesa_1")
        assert row["strategy_move"] == ""

    def test_strategy_missing_key(self, conn):
        """When strategy key is absent, json_extract returns None."""
        ocr = {"ocr": {"some": "data"}}
        _insert_spot(conn, table_id="mesa_1", ocr_json=json.dumps(ocr))

        row = _query_overlay(conn, "mesa_1")
        assert row["strategy_move"] is None
        assert row["strategy_betmin"] is None
        assert row["strategy_betmax"] is None


class TestOverlayVillanoTipos:
    """json_extract pulls villano tipo and name from nested ocr JSON."""

    def test_overlay_returns_villano_tipos(self, conn):
        ocr = {
            "ocr": {
                "villano": {
                    "p2": {"tipo": "fish", "name": "VillanoA"},
                    "p3": {"tipo": "reg", "name": "VillanoB"},
                }
            }
        }
        _insert_spot(conn, table_id="mesa_1", ocr_json=json.dumps(ocr))

        row = _query_overlay(conn, "mesa_1")

        assert row["p2_tipo"] == "fish"
        assert row["p3_tipo"] == "reg"
        assert row["p2_name"] == "VillanoA"
        assert row["p3_name"] == "VillanoB"


class TestOverlayLatestPerMesa:
    """ORDER BY detected_at_ms DESC returns the most recent spot."""

    def test_overlay_returns_latest_spot_per_mesa(self, conn):
        _insert_spot(conn, table_id="mesa_2", detected_at_ms=1000,
                     hand_class="77",
                     ocr_json=json.dumps({"strategy": {"move": "FOLD"}}))
        _insert_spot(conn, table_id="mesa_2", detected_at_ms=2000,
                     hand_class="AKs",
                     ocr_json=json.dumps({"strategy": {"move": "RAISE"}}))
        _insert_spot(conn, table_id="mesa_2", detected_at_ms=1500,
                     hand_class="QQ",
                     ocr_json=json.dumps({"strategy": {"move": "PUSH"}}))

        row = _query_overlay(conn, "mesa_2")

        assert row is not None
        assert row["detected_at_ms"] == 2000
        assert row["hand_class"] == "AKs"
        assert row["strategy_move"] == "RAISE"


class TestOverlayEmptyMesa:
    """No spots for a table_id returns no row."""

    def test_overlay_empty_mesa(self, conn):
        # Insert a spot for mesa_1 but query mesa_3
        _insert_spot(conn, table_id="mesa_1")
        row = _query_overlay(conn, "mesa_3")
        assert row is None

    def test_overlay_completely_empty_db(self, conn):
        row = _query_overlay(conn, "mesa_1")
        assert row is None


class TestUpdatePlayerTipo:
    """Replicate the update_player_tipo command from obs.rs."""

    def test_update_player_tipo(self, conn):
        conn.execute(
            "INSERT INTO players (name, tipo) VALUES (?, ?)",
            ("VillanoA", "fish"),
        )
        conn.commit()

        # Verify initial state
        row = conn.execute(
            "SELECT tipo FROM players WHERE name = ?", ("VillanoA",)
        ).fetchone()
        assert row["tipo"] == "fish"

        # Update
        conn.execute(
            "UPDATE players SET tipo = ? WHERE name = ?",
            ("reg", "VillanoA"),
        )
        conn.commit()

        row = conn.execute(
            "SELECT tipo FROM players WHERE name = ?", ("VillanoA",)
        ).fetchone()
        assert row["tipo"] == "reg"

    def test_update_nonexistent_player_changes_nothing(self, conn):
        cursor = conn.execute(
            "UPDATE players SET tipo = ? WHERE name = ?",
            ("reg", "Ghost"),
        )
        assert cursor.rowcount == 0
