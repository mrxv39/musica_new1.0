import sqlite3

import pytest

from modules.strategy.spots_strategies_repo import SpotStrategyMatchInput, find_unique_spot_strategy_id


@pytest.fixture()
def conn():
    c = sqlite3.connect(":memory:")
    c.row_factory = sqlite3.Row
    c.executescript(
        """
        CREATE TABLE spots_strategies (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          spot_key TEXT NOT NULL,
          stack_effective_min REAL NOT NULL,
          stack_effective_max REAL NOT NULL,
          bet_min REAL,
          bet_max REAL,
          p2_pos TEXT,
          p3_pos TEXT,
          p2_tipo TEXT,
          p3_tipo TEXT,
          hand_range TEXT
        );
        """
    )
    yield c
    c.close()


def _ins(
    conn,
    *,
    spot_key="BTN",
    se_min=0,
    se_max=999,
    bet_min=None,
    bet_max=None,
    p2_pos="",
    p3_pos="",
    p2_tipo="",
    p3_tipo="",
    hand_range="*",
):
    conn.execute(
        """
        INSERT INTO spots_strategies(spot_key,stack_effective_min,stack_effective_max,bet_min,bet_max,p2_pos,p3_pos,p2_tipo,p3_tipo,hand_range)
        VALUES (?,?,?,?,?,?,?,?,?,?)
        """,
        (
            spot_key,
            se_min,
            se_max,
            bet_min,
            bet_max,
            p2_pos,
            p3_pos,
            p2_tipo,
            p3_tipo,
            hand_range,
        ),
    )


def _inp(**kwargs):
    base = dict(
        spot_key="BTN",
        hand_class="AKs",
        p1_se_bb=10.0,
        p1_bet_bb=2.5,
        p2_pos="SB",
        p3_pos="BB",
        p2_tipo="FISH",
        p3_tipo="REG",
    )
    base.update(kwargs)
    return SpotStrategyMatchInput(**base)


def test_find_unique_spot_strategy_id_single_match(conn):
    _ins(conn, spot_key="BTN", se_min=6, se_max=75, p2_tipo="fish", p3_tipo="reg", p2_pos="SB", p3_pos="BB")
    _ins(conn, spot_key="BTN", se_min=6, se_max=75, p2_tipo="fish", p3_tipo="fish", hand_range="AA")

    sid = find_unique_spot_strategy_id(conn, _inp())
    assert isinstance(sid, int)
    assert sid == 1


def test_find_unique_spot_strategy_id_raises_when_no_rows_for_spot_key_and_se(conn):
    _ins(conn, spot_key="SB", se_min=6, se_max=75)
    with pytest.raises(ValueError, match="No spot strategies found"):
        find_unique_spot_strategy_id(conn, _inp(spot_key="BTN"))


def test_find_unique_spot_strategy_id_raises_when_constraints_filter_out_all(conn):
    _ins(conn, spot_key="BTN", se_min=6, se_max=75, p2_tipo="fish", p3_tipo="fish")
    with pytest.raises(ValueError, match="No matching spot strategy"):
        find_unique_spot_strategy_id(
            conn,
            _inp(p2_tipo="reg"),
        )


def test_find_unique_spot_strategy_id_none_when_hand_not_in_any_range(conn):
    _ins(conn, spot_key="BTN", se_min=6, se_max=75, p2_tipo="fish", p3_tipo="reg", hand_range="AA,KK")
    assert find_unique_spot_strategy_id(conn, _inp(hand_class="K7o")) is None


def test_find_unique_spot_strategy_id_tiebreak_by_specificity_tipo_and_bet(conn):
    _ins(conn, spot_key="BTN", se_min=6, se_max=75, hand_range="*")
    _ins(
        conn,
        spot_key="BTN",
        se_min=6,
        se_max=75,
        bet_min=2,
        bet_max=3,
        p2_tipo="fish",
        p3_tipo="reg",
        hand_range="*",
    )

    sid = find_unique_spot_strategy_id(conn, _inp())
    assert sid == 2


def test_find_unique_spot_strategy_id_ambiguous_when_best_score_ties(conn):
    _ins(conn, spot_key="BTN", se_min=6, se_max=75, p2_tipo="fish", p3_tipo="reg", hand_range="*")
    _ins(conn, spot_key="BTN", se_min=6, se_max=75, p2_tipo="fish", p3_tipo="reg", hand_range="*")
    with pytest.raises(ValueError, match="Ambiguous spot strategy match"):
        find_unique_spot_strategy_id(conn, _inp(p1_bet_bb=1.0))


def test_find_unique_spot_strategy_id_invalid_hand_class_returns_none(conn):
    _ins(conn, hand_range="*")
    assert find_unique_spot_strategy_id(conn, _inp(hand_class="")) is None
