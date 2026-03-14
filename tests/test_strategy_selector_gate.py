import os
import json
import sqlite3
import sys

import pytest

from modules.strategy.selector_diagnostics import (
    build_failure_error_message,
    collect_near_misses_bounds_field,
    collect_reasons_stats,
    format_top_near_misses,
    rows_matching_categorical,
)
from modules.strategy.selector_fallback import fallback_nearest_se
from modules.strategy.selector_models import MatchInput, SubStrategySpec
from modules.strategy.substrategy_repo import fetch_rows, find_unique_substrategy
from modules.strategy import substrategy_selector as selector_mod


def _payload(**overrides):
    payload = {
        "spot": "BTN",
        "hero_pos": "BTN",
        "p2_pos": "SB",
        "p3_pos": "BB",
        "p2_tipo": "fish",
        "p3_tipo": "reg",
        "p1_bet_min": 0,
        "p1_bet_max": 1,
        "p1_stack_min": 10,
        "p1_stack_max": 30,
        "p1_se_min": 10,
        "p1_se_max": 30,
        "p2_bet_min": 0,
        "p2_bet_max": 2,
        "p2_stack_min": 5,
        "p2_stack_max": 40,
        "p3_bet_min": 0,
        "p3_bet_max": 2,
        "p3_stack_min": 5,
        "p3_stack_max": 40,
        "orRanges": {"OR_TO_CALL_ANY": "AQs"},
        "orRangesPlan": {"OR_TO_CALL_ANY": {"move": "CALL", "bet_min_bb": 1.0, "bet_max_bb": 2.0}},
    }
    payload.update(overrides)
    return payload


def _inp(**overrides):
    base = dict(
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
    base.update(overrides)
    return MatchInput(**base)


def _row(row_id, name, situation_key, payload):
    return {
        "id": row_id,
        "name": name,
        "situation_key": situation_key,
        "payload_json": json.dumps(payload),
    }


def test_fallback_nearest_se_returns_unique_best_match():
    inp = _inp(p1_se_bb=33)
    row1 = _row(1, "r1", "TEST_SIT", _payload(p1_se_min=10, p1_se_max=30))
    row2 = _row(2, "r2", "TEST_SIT", _payload(p1_se_min=35, p1_se_max=50))
    rows = [
        (row1, SubStrategySpec.from_payload(json.loads(row1["payload_json"]))),
        (row2, SubStrategySpec.from_payload(json.loads(row2["payload_json"]))),
    ]

    chosen = fallback_nearest_se(inp, rows)

    assert chosen is not None
    best_row, payload, note = chosen
    assert best_row["id"] == 2
    assert payload["spot"] == "BTN"
    assert "chosen_id=2" in note


def test_fallback_nearest_se_returns_none_on_tie_and_no_candidates():
    tied_rows = [
        (_row(1, "r1", "TEST_SIT", _payload(p1_se_min=10, p1_se_max=18)), SubStrategySpec.from_payload(_payload(p1_se_min=10, p1_se_max=18))),
        (_row(2, "r2", "TEST_SIT", _payload(p1_se_min=22, p1_se_max=30)), SubStrategySpec.from_payload(_payload(p1_se_min=22, p1_se_max=30))),
    ]
    assert fallback_nearest_se(_inp(p1_se_bb=20), tied_rows) is None

    wrong_cat = [
        (_row(3, "r3", "TEST_SIT", _payload(p2_tipo="nit")), SubStrategySpec.from_payload(_payload(p2_tipo="nit"))),
    ]
    assert fallback_nearest_se(_inp(), wrong_cat) is None


def test_selector_diagnostics_helpers_cover_near_miss_reporting():
    rows_with_specs = [
        (_row(1, "r1", "TEST_SIT", _payload(p1_se_min=22, p1_se_max=30)), SubStrategySpec.from_payload(_payload(p1_se_min=22, p1_se_max=30))),
        (_row(2, "r2", "TEST_SIT", _payload(p2_tipo="nit")), SubStrategySpec.from_payload(_payload(p2_tipo="nit"))),
    ]
    inp = _inp(p1_se_bb=20)

    assert collect_reasons_stats({"a": 1, "b": 3, "c": 2}, limit=2) == [("b", 3), ("c", 2)]

    cat = rows_matching_categorical(inp, rows_with_specs)
    assert [row["id"] for row, _spec in cat] == [1]

    misses = collect_near_misses_bounds_field("p1_se", inp.p1_se_bb, cat)
    assert len(misses) == 1
    assert misses[0].row_id == 1
    assert format_top_near_misses(misses).startswith("[(id=1")
    assert format_top_near_misses([]) == "[]"

    message = build_failure_error_message(
        inp=inp,
        matches=[],
        reasons={"reason_a": 2},
        rows_with_specs=rows_with_specs,
        fallback_se_enabled=True,
    )
    assert "Expected exactly 1 match, got 0." in message
    assert "fallback_se_enabled=True" in message
    assert "near_miss_p1_se=" in message


def test_fetch_rows_and_find_unique_substrategy_with_fallback(monkeypatch):
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    conn.executescript(
        """
        CREATE TABLE spots (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE);
        CREATE TABLE strategies (
            id INTEGER PRIMARY KEY,
            spot_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            payload_json TEXT NOT NULL
        );
        """
    )
    conn.execute("INSERT INTO spots(id, name) VALUES (1, 'TEST_SIT')")
    conn.execute(
        "INSERT INTO strategies(id, spot_id, name, payload_json) VALUES (?, ?, ?, ?)",
        (10, 1, "s1", json.dumps(_payload(p1_se_min=10, p1_se_max=15))),
    )
    conn.execute(
        "INSERT INTO strategies(id, spot_id, name, payload_json) VALUES (?, ?, ?, ?)",
        (20, 1, "s2", json.dumps(_payload(p1_se_min=22, p1_se_max=30))),
    )
    conn.commit()

    rows = fetch_rows(conn)
    assert [row["id"] for row in rows] == [10, 20]

    monkeypatch.setenv("POKER_BOSS_FALLBACK_SE", "1")
    row, payload = find_unique_substrategy(conn, _inp(p1_se_bb=20))
    assert row["id"] == 20
    assert payload["_match_note"].startswith("fallback_se:")


def test_find_unique_substrategy_raises_with_diagnostics_when_no_rows_or_no_match(monkeypatch):
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    conn.executescript(
        """
        CREATE TABLE spots (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE);
        CREATE TABLE strategies (
            id INTEGER PRIMARY KEY,
            spot_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            payload_json TEXT NOT NULL
        );
        """
    )

    with pytest.raises(ValueError, match="No strategies rows in database"):
        find_unique_substrategy(conn, _inp())

    conn.execute("INSERT INTO spots(id, name) VALUES (1, 'TEST_SIT')")
    conn.execute(
        "INSERT INTO strategies(id, spot_id, name, payload_json) VALUES (?, ?, ?, ?)",
        (10, 1, "s1", json.dumps(_payload(p2_tipo="nit"))),
    )
    conn.commit()

    monkeypatch.delenv("POKER_BOSS_FALLBACK_SE", raising=False)
    with pytest.raises(ValueError, match="Expected exactly 1 match, got 0"):
        find_unique_substrategy(conn, _inp())


def test_substrategy_selector_main_supports_json_file_and_cli_args(monkeypatch, tmp_path, capsys):
    seen = {}

    def fake_select_move(inp):
        seen["inp"] = inp
        return {"move": "CALL"}

    monkeypatch.setattr(selector_mod, "select_move", fake_select_move)

    payload_path = tmp_path / "input.json"
    payload_path.write_text(json.dumps(_inp().__dict__), encoding="utf-8")
    monkeypatch.setattr(sys, "argv", ["prog", "--json", str(payload_path), "--fallback_se"])

    rc = selector_mod.main()
    out = json.loads(capsys.readouterr().out)
    assert rc == 0
    assert out["move"] == "CALL"
    assert seen["inp"].hand_class == "AQs"
    assert "POKER_BOSS_FALLBACK_SE" in os.environ

    monkeypatch.setattr(
        sys,
        "argv",
        [
            "prog",
            "--situacion", "TEST_SIT",
            "--spot", "BTN",
            "--hero_pos", "BTN",
            "--hand", "AKs",
            "--p1_bet", "0.5",
            "--p1_stack", "20",
            "--p1_se", "18",
            "--p2_pos", "SB",
            "--p2_tipo", "fish",
            "--p2_bet", "1",
            "--p2_stack", "10",
            "--p3_pos", "BB",
            "--p3_tipo", "reg",
            "--p3_bet", "1",
            "--p3_stack", "10",
        ],
    )

    rc = selector_mod.main()
    out = json.loads(capsys.readouterr().out)
    assert rc == 0
    assert out["move"] == "CALL"
    assert seen["inp"].p1_se_bb == 18.0
