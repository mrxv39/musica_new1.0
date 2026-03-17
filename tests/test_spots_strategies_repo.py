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
          p3_tipo TEXT
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
):
    conn.execute(
        """
        INSERT INTO spots_strategies(spot_key,stack_effective_min,stack_effective_max,bet_min,bet_max,p2_pos,p3_pos,p2_tipo,p3_tipo)
        VALUES (?,?,?,?,?,?,?,?,?)
        """,
        (spot_key, se_min, se_max, bet_min, bet_max, p2_pos, p3_pos, p2_tipo, p3_tipo),
    )


def test_find_unique_spot_strategy_id_single_match(conn):
    _ins(conn, spot_key="BTN", se_min=6, se_max=75, p2_tipo="fish", p3_tipo="reg", p2_pos="SB", p3_pos="BB")
    _ins(conn, spot_key="BTN", se_min=6, se_max=75, p2_tipo="fish", p3_tipo="fish")  # non-match

    sid = find_unique_spot_strategy_id(
        conn,
        SpotStrategyMatchInput(
            spot_key="btn",  # case-insensitive via _norm_pos
            p1_se_bb=10.0,
            p1_bet_bb=2.5,
            p2_pos="SB",
            p3_pos="BB",
            p2_tipo="FISH",
            p3_tipo="REG",
        ),
    )
    assert isinstance(sid, int)
    assert sid == 1


def test_find_unique_spot_strategy_id_raises_when_no_rows_for_spot_key_and_se(conn):
    _ins(conn, spot_key="SB", se_min=6, se_max=75)
    with pytest.raises(ValueError, match="No spot strategies found"):
        find_unique_spot_strategy_id(
            conn,
            SpotStrategyMatchInput(
                spot_key="BTN",
                p1_se_bb=10.0,
                p1_bet_bb=1.0,
                p2_pos="SB",
                p3_pos="BB",
                p2_tipo="fish",
                p3_tipo="fish",
            ),
        )


def test_find_unique_spot_strategy_id_raises_when_constraints_filter_out_all(conn):
    _ins(conn, spot_key="BTN", se_min=6, se_max=75, p2_tipo="fish", p3_tipo="fish")
    with pytest.raises(ValueError, match="No matching spot strategy"):
        find_unique_spot_strategy_id(
            conn,
            SpotStrategyMatchInput(
                spot_key="BTN",
                p1_se_bb=10.0,
                p1_bet_bb=1.0,
                p2_pos="SB",
                p3_pos="BB",
                p2_tipo="reg",  # mismatch
                p3_tipo="fish",
            ),
        )


def test_find_unique_spot_strategy_id_tiebreak_by_specificity_tipo_and_bet(conn):
    # Both match broadly, but one is more specific due to bet range and tipos
    _ins(conn, spot_key="BTN", se_min=6, se_max=75)  # generic
    _ins(conn, spot_key="BTN", se_min=6, se_max=75, bet_min=2, bet_max=3, p2_tipo="fish", p3_tipo="reg")

    sid = find_unique_spot_strategy_id(
        conn,
        SpotStrategyMatchInput(
            spot_key="BTN",
            p1_se_bb=10.0,
            p1_bet_bb=2.5,
            p2_pos="SB",
            p3_pos="BB",
            p2_tipo="FISH",
            p3_tipo="REG",
        ),
    )
    assert sid == 2


def test_find_unique_spot_strategy_id_ambiguous_when_best_score_ties(conn):
    _ins(conn, spot_key="BTN", se_min=6, se_max=75, p2_tipo="fish", p3_tipo="reg")
    _ins(conn, spot_key="BTN", se_min=6, se_max=75, p2_tipo="fish", p3_tipo="reg")
    with pytest.raises(ValueError, match="Ambiguous spot strategy match"):
        find_unique_spot_strategy_id(
            conn,
            SpotStrategyMatchInput(
                spot_key="BTN",
                p1_se_bb=10.0,
                p1_bet_bb=1.0,
                p2_pos="SB",
                p3_pos="BB",
                p2_tipo="FISH",
                p3_tipo="REG",
            ),
        )

