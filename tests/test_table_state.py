from modules.ocr.table_state import compute_table_state


def test_compute_table_state_3h():
    names = {"p2_name": "A", "p3_name": "B"}
    stacks = {"p1": 10.0, "p2": 20.0, "p3": 30.0}

    out = compute_table_state(names, stacks)

    assert out["ok"] is True
    assert out["players"] == 3
    assert out["is_3h"] is True
    assert out["is_hu"] is False
    assert out["active_seats"] == ["p1", "p2", "p3"]
    assert out["eliminated_seats"] == []


def test_compute_table_state_hu():
    names = {"p2_name": "A", "p3_name": ""}
    stacks = {"p1": 15.0, "p2": 22.0, "p3": None}

    out = compute_table_state(names, stacks)

    assert out["ok"] is True
    assert out["players"] == 2
    assert out["is_hu"] is True
    assert out["is_3h"] is False
    assert out["active_seats"] == ["p1", "p2"]
    assert out["eliminated_seats"] == ["p3"]


def test_compute_table_state_count_invalido_ok_false():
    names = {"p2_name": "", "p3_name": ""}
    stacks = {"p1": None, "p2": None, "p3": None}

    out = compute_table_state(names, stacks)

    assert out["ok"] is False
    assert out["players"] == 0
    assert "unknown_players_count" in out["errors"]
