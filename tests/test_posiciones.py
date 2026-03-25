from modules.ocr.posiciones import read_posiciones


def test_read_posiciones_3h_desde_dealer():
    table_state = {
        "ok": True,
        "players": 3,
        "is_hu": False,
        "is_3h": True,
        "active_seats": ["p1", "p2", "p3"],
    }
    bets = {"p1": 0.0, "p2": 0.5, "p3": 1.0}
    dealer = {"ok": True, "dealer_seat": "p1", "score": 0.92}

    out = read_posiciones(table_state, bets, dealer)

    assert out["ok"] is True
    assert out["p1"] == "BTN"
    assert out["p2"] == "SB"
    assert out["p3"] == "BB"
    assert out["btn_seat"] == "p1"
    assert out["sb_seat"] == "p2"
    assert out["bb_seat"] == "p3"


def test_read_posiciones_hu_desde_dealer():
    table_state = {
        "ok": True,
        "players": 2,
        "is_hu": True,
        "is_3h": False,
        "active_seats": ["p1", "p3"],
    }
    bets = {"p1": 1.0, "p2": 0.0, "p3": 0.5}
    dealer = {"ok": True, "dealer_seat": "p3", "score": 0.88}

    out = read_posiciones(table_state, bets, dealer)

    assert out["ok"] is True
    assert out["p3"] == "SB"
    assert out["p1"] == "BB"
    assert out["dealer_seat"] == "p3"
    assert out["btn_seat"] == "p3"
    assert out["sb_seat"] == "p3"
    assert out["bb_seat"] == "p1"


def test_read_posiciones_3h_fallback_por_bets():
    table_state = {
        "ok": True,
        "players": 3,
        "is_hu": False,
        "is_3h": True,
        "active_seats": ["p1", "p2", "p3"],
    }
    bets = {"p1": 0.0, "p2": 0.5, "p3": 1.0}
    dealer = {"ok": False, "errors": ["dealer_not_found"]}

    out = read_posiciones(table_state, bets, dealer)

    assert out["ok"] is True
    assert out["method"] == "bets_blinds_pattern"
    assert out["p1"] == "BTN"
    assert out["p2"] == "SB"
    assert out["p3"] == "BB"


def test_read_posiciones_hu_fallback_por_bets():
    table_state = {
        "ok": True,
        "players": 2,
        "is_hu": True,
        "is_3h": False,
        "active_seats": ["p1", "p2"],
    }
    bets = {"p1": 0.5, "p2": 1.0, "p3": 0.0}
    dealer = {"ok": False, "errors": ["dealer_not_found"]}

    out = read_posiciones(table_state, bets, dealer)

    assert out["ok"] is True
    assert out["method"] == "bets_blinds_pattern"
    assert out["p1"] == "SB"
    assert out["p2"] == "BB"
    assert out["btn_seat"] == "p1"
    assert out["sb_seat"] == "p1"
    assert out["bb_seat"] == "p2"


def test_read_posiciones_pattern_not_matched_ok_false():
    table_state = {
        "ok": True,
        "players": 3,
        "is_hu": False,
        "is_3h": True,
        "active_seats": ["p1", "p2", "p3"],
    }
    bets = {"p1": 0.2, "p2": 0.7, "p3": 1.0}
    dealer = {"ok": False, "errors": ["dealer_not_found"]}

    out = read_posiciones(table_state, bets, dealer)

    assert out["ok"] is False
    assert "pattern_not_matched" in out["errors"]
