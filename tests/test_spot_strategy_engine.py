import sqlite3

import pytest

from modules.strategy.spot_strategy_engine import SpotDecisionInput, decide_spot_strategy


@pytest.fixture()
def conn():
    c = sqlite3.connect(":memory:")
    c.row_factory = sqlite3.Row
    c.executescript(
        """
        CREATE TABLE spots_strategy_scopes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          spot_key TEXT NOT NULL,
          p2_tipo TEXT NOT NULL,
          p3_tipo TEXT NOT NULL,
          scope_se_min REAL NOT NULL,
          scope_se_max REAL NOT NULL,
          sheet_name TEXT NOT NULL
        );

        CREATE TABLE spots_strategies (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          spot_key TEXT NOT NULL,
          hand_range_name TEXT NOT NULL,
          move TEXT NOT NULL,
          bet_min TEXT,
          bet_max TEXT,
          hand_range TEXT,
          stack_effective_min REAL NOT NULL,
          stack_effective_max REAL NOT NULL,
          p1_pos TEXT,
          p2_pos TEXT,
          p3_pos TEXT,
          p2_tipo TEXT,
          p3_tipo TEXT
        );

        CREATE TABLE spots_strategies_nash (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          spot_key TEXT NOT NULL,
          hand_range_name TEXT NOT NULL,
          move TEXT NOT NULL,
          hand_class TEXT NOT NULL,
          stack_effective_min REAL NOT NULL,
          stack_effective_max REAL NOT NULL,
          p2_pos TEXT,
          p3_pos TEXT,
          p2_tipo TEXT,
          p3_tipo TEXT
        );
        """
    )
    yield c
    c.close()


def test_decide_spot_strategy_hoja1_or_range_fold_default(conn):
    # Hoja1 for BTN vs fish/fish
    conn.execute(
        """
        INSERT INTO spots_strategy_scopes(spot_key,p2_tipo,p3_tipo,scope_se_min,scope_se_max,sheet_name)
        VALUES ('BTN','fish','fish',6,75,'Hoja1')
        """
    )
    conn.execute(
        """
        INSERT INTO spots_strategies(spot_key,hand_range_name,move,bet_min,bet_max,hand_range,stack_effective_min,stack_effective_max,p2_tipo,p3_tipo)
        VALUES ('BTN','OR TO CALL ANY','OR','2','75','AA-99',6,75,'fish','fish')
        """
    )
    # Not in range -> fold
    out = decide_spot_strategy(
        conn,
        SpotDecisionInput(
            spot_key="BTN",
            hand_class="K7o",
            p1_se_bb=10.0,
            p1_bet_bb=2.0,
            p2_pos="SB",
            p3_pos="BB",
            p2_tipo="FISH",
            p3_tipo="FISH",
        ),
    )
    assert out["ok"] is True
    assert out["move"] == "FOLD"
    assert out["betmin"] == 0
    assert out["betmax"] == 0
    assert out.get("spot_strategy_id") is None


def test_decide_spot_strategy_hoja1_picks_row_matching_hand(conn):
    conn.execute(
        """
        INSERT INTO spots_strategy_scopes(spot_key,p2_tipo,p3_tipo,scope_se_min,scope_se_max,sheet_name)
        VALUES ('BTN','fish','fish',6,75,'Hoja1')
        """
    )
    conn.execute(
        """
        INSERT INTO spots_strategies(spot_key,hand_range_name,move,bet_min,bet_max,hand_range,stack_effective_min,stack_effective_max,p2_tipo,p3_tipo)
        VALUES ('BTN','OR','OR','2','75','AA-99',6,75,'fish','fish')
        """
    )
    conn.execute(
        """
        INSERT INTO spots_strategies(spot_key,hand_range_name,move,bet_min,bet_max,hand_range,stack_effective_min,stack_effective_max,p2_tipo,p3_tipo)
        VALUES ('BTN','PUSH','PUSH','2','75','AKs',6,75,'fish','fish')
        """
    )
    out = decide_spot_strategy(
        conn,
        SpotDecisionInput(
            spot_key="BTN",
            hand_class="AKs",
            p1_se_bb=10.0,
            p1_bet_bb=2.0,
            p2_pos="SB",
            p3_pos="BB",
            p2_tipo="fish",
            p3_tipo="fish",
        ),
    )
    assert out["ok"] is True
    assert out["move"] == "PUSH"
    assert out["spot_strategy_id"] == 2


def test_decide_spot_strategy_hoja1_or_range_hit(conn):
    conn.execute(
        """
        INSERT INTO spots_strategy_scopes(spot_key,p2_tipo,p3_tipo,scope_se_min,scope_se_max,sheet_name)
        VALUES ('BTN','fish','fish',6,75,'Hoja1')
        """
    )
    conn.execute(
        """
        INSERT INTO spots_strategies(spot_key,hand_range_name,move,bet_min,bet_max,hand_range,stack_effective_min,stack_effective_max,p2_tipo,p3_tipo)
        VALUES ('BTN','OR TO CALL ANY','OR','2','75','AKs,AA',6,75,'fish','fish')
        """
    )
    out = decide_spot_strategy(
        conn,
        SpotDecisionInput(
            spot_key="BTN",
            hand_class="AKs",
            p1_se_bb=10.0,
            p1_bet_bb=2.0,
            p2_pos="SB",
            p3_pos="BB",
            p2_tipo="fish",
            p3_tipo="fish",
        ),
    )
    assert out["ok"] is True
    assert out["move"] == "OR"
    assert out["betmin"] == 2.0
    assert out["betmax"] == 75.0


def test_decide_spot_strategy_nash_push(conn):
    conn.execute(
        """
        INSERT INTO spots_strategy_scopes(spot_key,p2_tipo,p3_tipo,scope_se_min,scope_se_max,sheet_name)
        VALUES ('BTN','fish','fish',0.01,6,'Nash Push Fold')
        """
    )
    conn.execute(
        """
        INSERT INTO spots_strategies_nash(spot_key,hand_range_name,move,hand_class,stack_effective_min,stack_effective_max,p2_pos,p3_pos,p2_tipo,p3_tipo)
        VALUES ('BTN','NASH','PUSH','AKs',0.01,6,'','', 'fish','fish')
        """
    )
    out = decide_spot_strategy(
        conn,
        SpotDecisionInput(
            spot_key="BTN",
            hand_class="AKs",
            p1_se_bb=5.0,
            p1_bet_bb=0.0,
            p2_pos="SB",
            p3_pos="BB",
            p2_tipo="fish",
            p3_tipo="fish",
        ),
    )
    assert out["ok"] is True
    assert out["move"] == "PUSH"
    assert out["betmin"] == 75
    assert out["betmax"] == 75


def test_decide_spot_strategy_raises_when_no_scope_matches(conn):
    with pytest.raises(ValueError, match="No strategy scope matches"):
        decide_spot_strategy(
            conn,
            SpotDecisionInput(
                spot_key="BTN",
                hand_class="AKs",
                p1_se_bb=5.0,
                p1_bet_bb=0.0,
                p2_pos="SB",
                p3_pos="BB",
                p2_tipo="fish",
                p3_tipo="fish",
            ),
        )

