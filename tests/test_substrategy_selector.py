# C:\Users\Usuario\Desktop\proyectos\poker_boss\tests\test_substrategy_selector.py

import json
import sqlite3

import pytest

import modules.db.db as dbmod
from modules.strategy.substrategy_selector import MatchInput, select_move


def _make_db(tmp_path):
    db_path = tmp_path / "test.db"
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    cur.executescript(
        """
        CREATE TABLE spots (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE
        );
        CREATE TABLE strategies (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          spot_id INTEGER NOT NULL,
          name TEXT NOT NULL,
          payload_json TEXT NOT NULL DEFAULT '{}'
        );
        """
    )
    conn.commit()
    return conn, db_path


def test_select_move_unique_match(monkeypatch, tmp_path):
    conn, db_path = _make_db(tmp_path)
    cur = conn.cursor()
    cur.execute("INSERT INTO spots(name) VALUES(?)", ("TEST_SIT",))
    spot_id = cur.lastrowid

    payload = {
        "situacion": "TEST_SIT",
        "spot": "BTN",
        "hero_pos": "BTN",
        "p1_bet_min": 0,
        "p1_bet_max": 1,
        "p1_stack_min": 10,
        "p1_stack_max": 30,
        "p1_se_min": 10,
        "p1_se_max": 30,
        "p2_pos": "SB",
        "p2_tipo": "fish",
        "p2_bet_min": 0,
        "p2_bet_max": 2,
        "p2_stack_min": 5,
        "p2_stack_max": 40,
        "p3_pos": "BB",
        "p3_tipo": "reg",
        "p3_bet_min": 0,
        "p3_bet_max": 2,
        "p3_stack_min": 5,
        "p3_stack_max": 40,
        "orRanges": {
            "OR_TO_CALL_ANY": "AQs,AKs",
            "OPEN_PUSH": "",
            "OR_TO_CALL_SMALL": "",
            "OR_TO_FOLD": "",
        },
        "orRangesPlan": {
            "OR_TO_CALL_ANY": {"move": "CALL", "bet_min_bb": 1.0, "bet_max_bb": 2.0},
            "OPEN_PUSH": {"move": "OPEN_PUSH", "bet_min_bb": 0, "bet_max_bb": 0},
            "OR_TO_CALL_SMALL": {"move": "RAISE", "bet_min_bb": 2, "bet_max_bb": 3},
            "OR_TO_FOLD": {"move": "FOLD", "bet_min_bb": 0, "bet_max_bb": 0},
        },
    }
    cur.execute(
        "INSERT INTO strategies(spot_id,name,payload_json) VALUES(?,?,?)",
        (spot_id, "20_75_BB", json.dumps(payload)),
    )
    conn.commit()
    conn.close()

    monkeypatch.setenv("POKER_BOSS_DB_PATH", str(db_path))
    monkeypatch.setenv("MUSICA_DB_PATH", str(db_path))
    dbmod._DB_CONN = None
    dbmod._DB_PATH_ACTIVE = None

    inp = MatchInput(
        situacion="TEST_SIT",
        spot="BTN",
        hero_pos="BTN",
        hand_class="AQs",
        p1_bet_bb=0.5,
        p1_stack_bb=20,
        p1_se_bb=20,
        p2_pos="SB",
        p2_tipo="fish",
        p2_bet_bb=1,
        p2_stack_bb=10,
        p3_pos="BB",
        p3_tipo="reg",
        p3_bet_bb=1,
        p3_stack_bb=10,
    )

    out = select_move(inp)
    assert out["move"] == "CALL"
    assert out["bet_min_bb"] == 1.0
    assert out["bet_max_bb"] == 2.0
    assert out["range_key"] == "OR_TO_CALL_ANY"


def test_select_move_default_fold_when_not_in_any_or_range(monkeypatch, tmp_path):
    conn, db_path = _make_db(tmp_path)
    cur = conn.cursor()
    cur.execute("INSERT INTO spots(name) VALUES(?)", ("TEST_SIT",))
    spot_id = cur.lastrowid

    payload = {
        "situacion": "TEST_SIT",
        "spot": "BTN",
        "hero_pos": "BTN",
        "p1_bet_min": 0,
        "p1_bet_max": 1,
        "p1_stack_min": 10,
        "p1_stack_max": 30,
        "p1_se_min": 10,
        "p1_se_max": 30,
        "p2_pos": "SB",
        "p2_tipo": "fish",
        "p2_bet_min": 0,
        "p2_bet_max": 2,
        "p2_stack_min": 5,
        "p2_stack_max": 40,
        "p3_pos": "BB",
        "p3_tipo": "reg",
        "p3_bet_min": 0,
        "p3_bet_max": 2,
        "p3_stack_min": 5,
        "p3_stack_max": 40,
        "orRanges": {
            "OR_TO_CALL_ANY": "AQs,AKs",
            "OPEN_PUSH": "",
            "OR_TO_CALL_SMALL": "",
            "OR_TO_FOLD": "",
        },
        "orRangesPlan": {
            "OR_TO_CALL_ANY": {"move": "CALL", "bet_min_bb": 1.0, "bet_max_bb": 2.0},
            "OPEN_PUSH": {"move": "OPEN_PUSH", "bet_min_bb": 0, "bet_max_bb": 0},
            "OR_TO_CALL_SMALL": {"move": "RAISE", "bet_min_bb": 2, "bet_max_bb": 3},
            "OR_TO_FOLD": {"move": "FOLD", "bet_min_bb": 0, "bet_max_bb": 0},
        },
    }
    cur.execute(
        "INSERT INTO strategies(spot_id,name,payload_json) VALUES(?,?,?)",
        (spot_id, "20_75_BB", json.dumps(payload)),
    )
    conn.commit()
    conn.close()

    monkeypatch.setenv("POKER_BOSS_DB_PATH", str(db_path))
    monkeypatch.setenv("MUSICA_DB_PATH", str(db_path))
    dbmod._DB_CONN = None
    dbmod._DB_PATH_ACTIVE = None

    inp = MatchInput(
        situacion="TEST_SIT",
        spot="BTN",
        hero_pos="BTN",
        hand_class="72o",  # no está en OR_TO_CALL_ANY
        p1_bet_bb=0.5,
        p1_stack_bb=20,
        p1_se_bb=20,
        p2_pos="SB",
        p2_tipo="fish",
        p2_bet_bb=1,
        p2_stack_bb=10,
        p3_pos="BB",
        p3_tipo="reg",
        p3_bet_bb=1,
        p3_stack_bb=10,
    )

    out = select_move(inp)
    assert out["move"] == "FOLD"
    assert out["bet_min_bb"] == 0.0
    assert out["bet_max_bb"] == 0.0
    assert out["range_key"] == "FOLD"
