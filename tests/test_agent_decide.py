"""Tests for modules/agent/decide.py — the agent decision pipeline."""

from __future__ import annotations

import json
import sqlite3
import time

import pytest

from modules.agent.models import AgentDecision, GameState
from modules.agent.decide import decide
from modules.agent.historical import query_historical_action
from modules.db.schema import SCHEMA_TABLES_SQL
from modules.importers.championpoker_xml_importer import SCHEMA_SQL as IMPORTER_SCHEMA_SQL


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

def _make_conn() -> sqlite3.Connection:
    """Create an in-memory SQLite connection with all required tables."""
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    conn.executescript(SCHEMA_TABLES_SQL)
    conn.executescript(IMPORTER_SCHEMA_SQL)
    return conn


@pytest.fixture
def conn():
    c = _make_conn()
    yield c
    c.close()


def _default_state(**overrides) -> GameState:
    """Build a GameState with sensible defaults; override any field."""
    defaults = dict(
        hand_class="AKs",
        hero_pos="BTN",
        p2_pos="SB",
        p3_pos="BB",
        p2_tipo="fish",
        p3_tipo="reg",
        p1_stack_bb=15.0,
        p1_bet_bb=0.0,
        p1_se_bb=15.0,
        p2_stack_bb=20.0,
        p2_bet_bb=0.5,
        p3_stack_bb=18.0,
        p3_bet_bb=1.0,
        mesa=1,
    )
    defaults.update(overrides)
    return GameState(**defaults)


# ---------------------------------------------------------------------------
# Helpers to populate the DB
# ---------------------------------------------------------------------------

def _insert_scope(conn, *, spot_key="BTN", p2_tipo="fish", p3_tipo="reg",
                  se_min=0.0, se_max=100.0, sheet_name="Hoja1"):
    conn.execute(
        """INSERT INTO spots_strategy_scopes
           (spot_key, p2_tipo, p3_tipo, scope_se_min, scope_se_max, sheet_name)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (spot_key, p2_tipo, p3_tipo, se_min, se_max, sheet_name),
    )
    conn.commit()


def _insert_strategy(conn, *, spot_key="BTN", hand_range_name="value",
                     move="RAISE", bet_min=2.5, bet_max=3.0,
                     hand_range="AKs,AKo,AA,KK,QQ",
                     se_min=0.0, se_max=100.0,
                     p2_pos="", p3_pos="", p2_tipo="", p3_tipo="",
                     p1bet_min=None, p1bet_max=None):
    conn.execute(
        """INSERT INTO spots_strategies
           (spot_key, hand_range_name, move, bet_min, bet_max, hand_range,
            stack_effective_min, stack_effective_max,
            p2_pos, p3_pos, p2_tipo, p3_tipo, p1bet_min, p1bet_max)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (spot_key, hand_range_name, move, bet_min, bet_max, hand_range,
         se_min, se_max, p2_pos, p3_pos, p2_tipo, p3_tipo, p1bet_min, p1bet_max),
    )
    conn.commit()


def _insert_nash(conn, *, spot_key="BTN", hand_class="AKs", move="PUSH",
                 se_min=0.0, se_max=100.0, p2_pos="", p3_pos="",
                 p2_tipo="", p3_tipo=""):
    conn.execute(
        """INSERT INTO spots_strategies_nash
           (spot_key, hand_range_name, move, hand_class,
            stack_effective_min, stack_effective_max,
            p2_pos, p3_pos, p2_tipo, p3_tipo)
           VALUES (?, 'nash', ?, ?, ?, ?, ?, ?, ?, ?)""",
        (spot_key, move, hand_class, se_min, se_max,
         p2_pos, p3_pos, p2_tipo, p3_tipo),
    )
    conn.commit()


def _insert_historical_hand(conn, hand_id, *, hero="Hero", hero_cards="DA DK",
                            hero_pos="BTN", se_bb=15.0, bb=1.0,
                            action_type_name="Raises", action_type_id=5,
                            action_sum_bb=3.0):
    """Insert a hand_real + spots_xml_real + actions_real row for historical queries."""
    gamecode = f"GAME{hand_id}"
    conn.execute(
        """INSERT INTO hands
           (id, room, hero, source_file, gamecode, bb, hero_cards)
           VALUES (?, 'test', ?, 'test.xml', ?, ?, ?)""",
        (hand_id, hero, gamecode, bb, hero_cards),
    )
    conn.execute(
        """INSERT INTO spots_xml_real
           (hand_id, gamecode, street, spot_index, hero_cards, hero_position,
            effective_stack_bb, created_at)
           VALUES (?, ?, 'preflop', 0, ?, ?, ?, ?)""",
        (hand_id, gamecode, hero_cards, hero_pos, se_bb, int(time.time())),
    )
    conn.execute(
        """INSERT INTO actions_real
           (hand_id, gamecode, round_no, action_no, player, type_id, type_name, sum_bb)
           VALUES (?, ?, 1, 1, ?, ?, ?, ?)""",
        (hand_id, gamecode, hero, action_type_id, action_type_name, action_sum_bb),
    )
    conn.commit()


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestDecideStrategyEngine:
    """decide() returns strategy_engine result when a matching strategy exists."""

    def test_decide_returns_strategy_engine_result(self, conn):
        _insert_scope(conn, spot_key="BTN", p2_tipo="fish", p3_tipo="reg",
                      se_min=0, se_max=100, sheet_name="Hoja1")
        _insert_strategy(conn, spot_key="BTN", move="RAISE",
                         bet_min=2.5, bet_max=3.0,
                         hand_range="AKs,AKo,AA,KK,QQ",
                         se_min=0, se_max=100)

        state = _default_state(hand_class="AKs")
        result = decide(state, conn)

        assert isinstance(result, AgentDecision)
        assert result.action == "RAISE"
        assert result.confidence == 1.0
        assert result.source == "strategy_engine"
        assert result.bet_min == 2.5
        assert result.bet_max == 3.0


class TestDecideHistorical:
    """decide() falls through to historical when no strategy matches."""

    def test_decide_falls_through_to_historical(self, conn):
        # No strategies at all — historical data should be used.
        # Insert 5 hands with the same hero_cards (DA DK = AKs), same position, similar SE.
        for i in range(1, 6):
            _insert_historical_hand(
                conn, hand_id=i,
                hero_cards="DA DK",  # AKs
                hero_pos="BTN",
                se_bb=15.0,
                action_type_name="Raises",
                action_type_id=5,
                action_sum_bb=3.0,
            )

        state = _default_state(hand_class="AKs", hero_pos="BTN", p1_se_bb=15.0)
        result = decide(state, conn)

        assert isinstance(result, AgentDecision)
        assert result.action == "RAISE"
        assert result.source == "historical"
        assert result.confidence > 0.0
        assert result.details["total_samples"] >= 3


class TestDecideDefaultFold:
    """decide() returns default FOLD when DB is empty."""

    def test_decide_default_fold(self, conn):
        state = _default_state()
        result = decide(state, conn)

        assert isinstance(result, AgentDecision)
        assert result.action == "FOLD"
        assert result.confidence == 0.0
        assert result.source == "default_fold"


class TestDecideNashPush:
    """decide() returns PUSH with confidence 0.8 from nash table."""

    def test_decide_nash_push(self, conn):
        # Scope must point to the nash sheet
        _insert_scope(conn, spot_key="BTN", p2_tipo="fish", p3_tipo="reg",
                      se_min=0, se_max=100, sheet_name="Nash Push Fold")
        _insert_nash(conn, spot_key="BTN", hand_class="AKs", move="PUSH",
                     se_min=0, se_max=100)

        state = _default_state(hand_class="AKs")
        result = decide(state, conn)

        assert result.action == "PUSH"
        assert result.confidence == 0.8
        assert result.source == "strategy_engine"
        assert result.bet_min == 75
        assert result.bet_max == 75


class TestHistoricalMinSamples:
    """query_historical_action returns None when fewer than min_samples hands match."""

    def test_historical_min_samples_not_met(self, conn):
        # Only 2 hands — below the default min_samples=3
        for i in range(1, 3):
            _insert_historical_hand(
                conn, hand_id=i,
                hero_cards="DA DK",
                hero_pos="BTN",
                se_bb=15.0,
                action_type_name="Raises",
                action_type_id=5,
                action_sum_bb=3.0,
            )

        state = _default_state(hand_class="AKs", hero_pos="BTN", p1_se_bb=15.0)
        result = query_historical_action(conn, state)

        assert result is None

    def test_historical_exactly_min_samples(self, conn):
        # Exactly 3 hands — should return a result
        for i in range(1, 4):
            _insert_historical_hand(
                conn, hand_id=i,
                hero_cards="DA DK",
                hero_pos="BTN",
                se_bb=15.0,
                action_type_name="Calls",
                action_type_id=4,
                action_sum_bb=1.0,
            )

        state = _default_state(hand_class="AKs", hero_pos="BTN", p1_se_bb=15.0)
        result = query_historical_action(conn, state)

        assert result is not None
        assert result["action"] == "CALL"
        assert result["total_samples"] == 3
