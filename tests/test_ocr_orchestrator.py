import modules.ocr.ocr as ocrmod


def test_run_ocr_agrega_submodulos_correctamente(monkeypatch):
    monkeypatch.setattr(ocrmod.bets, "read_bets", lambda *a, **k: {"ok": True, "p1": 0.0, "p2": 0.5, "p3": 1.0, "errors": []})
    monkeypatch.setattr(ocrmod.stacks, "read_stacks", lambda *a, **k: {"ok": True, "p1": 10.0, "p2": 20.0, "p3": 30.0, "errors": []})
    monkeypatch.setattr(ocrmod.names, "read_names", lambda *a, **k: {"ok": True, "p2_name": "N1", "p3_name": "N2", "errors": []})
    monkeypatch.setattr(ocrmod.villano, "classify_villano", lambda *a, **k: {"ok": True, "p2": {"name": "N1", "tipo": "fish"}, "p3": {"name": "N2", "tipo": "reg"}, "errors": []})
    monkeypatch.setattr(ocrmod.table_state, "compute_table_state", lambda *a, **k: {"ok": True, "players": 3, "is_hu": False, "is_3h": True, "active_seats": ["p1", "p2", "p3"], "errors": []})
    monkeypatch.setattr(ocrmod.dealer, "read_dealer", lambda *a, **k: {"ok": True, "dealer_seat": "p1", "score": 0.95, "errors": []})
    monkeypatch.setattr(ocrmod.posiciones, "read_posiciones", lambda *a, **k: {"ok": True, "p1": "BTN", "p2": "SB", "p3": "BB", "errors": []})

    out = ocrmod.run_ocr("fake.bmp")

    assert out["ok"] is True
    assert out["stackefectivo"] == {}
    assert out["bets"]["p2"] == 0.5
    assert out["stacks"]["p3"] == 30.0
    assert out["names"]["p2_name"] == "N1"
    assert out["villano"]["p3"]["tipo"] == "reg"
    assert out["dealer"]["dealer_seat"] == "p1"
    assert out["posiciones"]["p1"] == "BTN"


def test_run_ocr_ok_true_si_cualquier_submodulo_ok(monkeypatch):
    monkeypatch.setattr(ocrmod.bets, "read_bets", lambda *a, **k: {"ok": False, "errors": ["x"]})
    monkeypatch.setattr(ocrmod.stacks, "read_stacks", lambda *a, **k: {"ok": False, "errors": ["x"]})
    monkeypatch.setattr(ocrmod.names, "read_names", lambda *a, **k: {"ok": True, "p2_name": "SoloUno", "p3_name": "", "errors": []})
    monkeypatch.setattr(ocrmod.villano, "classify_villano", lambda *a, **k: {"ok": False, "errors": ["x"]})
    monkeypatch.setattr(ocrmod.table_state, "compute_table_state", lambda *a, **k: {"ok": False, "errors": ["x"]})
    monkeypatch.setattr(ocrmod.dealer, "read_dealer", lambda *a, **k: {"ok": False, "errors": ["x"]})
    monkeypatch.setattr(ocrmod.posiciones, "read_posiciones", lambda *a, **k: {"ok": False, "errors": ["x"]})

    out = ocrmod.run_ocr("fake.bmp")
    assert out["ok"] is True


def test_run_ocr_agrega_errors_de_submodulos(monkeypatch):
    monkeypatch.setattr(ocrmod.bets, "read_bets", lambda *a, **k: {"ok": False, "errors": ["ocr_failed"]})
    monkeypatch.setattr(ocrmod.stacks, "read_stacks", lambda *a, **k: {"ok": False, "errors": []})
    monkeypatch.setattr(ocrmod.names, "read_names", lambda *a, **k: {"ok": False, "errors": ["no_valid_names"]})
    monkeypatch.setattr(ocrmod.villano, "classify_villano", lambda *a, **k: {"ok": False, "errors": []})
    monkeypatch.setattr(ocrmod.table_state, "compute_table_state", lambda *a, **k: {"ok": False, "errors": ["unknown_players_count"]})
    monkeypatch.setattr(ocrmod.dealer, "read_dealer", lambda *a, **k: {"ok": False, "errors": ["dealer_not_found"]})
    monkeypatch.setattr(ocrmod.posiciones, "read_posiciones", lambda *a, **k: {"ok": False, "errors": ["pattern_not_matched"]})

    out = ocrmod.run_ocr("fake.bmp")

    assert out["stackefectivo"] == {}
    assert "bets:ocr_failed" in out["errors"]
    assert "names:no_valid_names" in out["errors"]
    assert "table_state:unknown_players_count" in out["errors"]
    assert "dealer:dealer_not_found" in out["errors"]
    assert "posiciones:pattern_not_matched" in out["errors"]


def test_run_ocr_pasa_names_a_villano(monkeypatch):
    monkeypatch.setattr(ocrmod.bets, "read_bets", lambda *a, **k: {"ok": False, "errors": []})
    monkeypatch.setattr(ocrmod.stacks, "read_stacks", lambda *a, **k: {"ok": False, "errors": []})
    monkeypatch.setattr(ocrmod.names, "read_names", lambda *a, **k: {"ok": True, "p2_name": "Alpha", "p3_name": "Beta", "errors": []})

    seen = {}

    def fake_villano(**kwargs):
        seen["kwargs"] = kwargs
        return {"ok": True, "p2": {"name": kwargs["p2_name"], "tipo": "fish"}, "p3": {"name": kwargs["p3_name"], "tipo": "fish"}, "errors": []}

    monkeypatch.setattr(ocrmod.villano, "classify_villano", fake_villano)
    monkeypatch.setattr(ocrmod.table_state, "compute_table_state", lambda *a, **k: {"ok": False, "errors": []})
    monkeypatch.setattr(ocrmod.dealer, "read_dealer", lambda *a, **k: {"ok": False, "errors": []})
    monkeypatch.setattr(ocrmod.posiciones, "read_posiciones", lambda *a, **k: {"ok": False, "errors": []})

    ocrmod.run_ocr("fake.bmp", x1=11, y1=22)

    assert seen["kwargs"]["p2_name"] == "Alpha"
    assert seen["kwargs"]["p3_name"] == "Beta"
    assert seen["kwargs"]["x1"] == 11
    assert seen["kwargs"]["y1"] == 22


def test_run_ocr_pasa_active_seats_a_dealer(monkeypatch):
    monkeypatch.setattr(ocrmod.bets, "read_bets", lambda *a, **k: {"ok": False, "errors": []})
    monkeypatch.setattr(ocrmod.stacks, "read_stacks", lambda *a, **k: {"ok": False, "errors": []})
    monkeypatch.setattr(ocrmod.names, "read_names", lambda *a, **k: {"ok": False, "errors": []})
    monkeypatch.setattr(ocrmod.villano, "classify_villano", lambda *a, **k: {"ok": False, "errors": []})
    monkeypatch.setattr(
        ocrmod.table_state,
        "compute_table_state",
        lambda *a, **k: {"ok": True, "players": 2, "is_hu": True, "is_3h": False, "active_seats": ["p1", "p3"], "errors": []},
    )

    seen = {}

    def fake_dealer(*args, **kwargs):
        seen["active_seats"] = kwargs.get("active_seats")
        return {"ok": True, "dealer_seat": "p3", "score": 0.9, "errors": []}

    monkeypatch.setattr(ocrmod.dealer, "read_dealer", fake_dealer)
    monkeypatch.setattr(ocrmod.posiciones, "read_posiciones", lambda *a, **k: {"ok": False, "errors": []})

    ocrmod.run_ocr("fake.bmp")
    assert seen["active_seats"] == ["p1", "p3"]


def test_run_ocr_llama_posiciones_con_table_state_bets_y_dealer(monkeypatch):
    monkeypatch.setattr(ocrmod.bets, "read_bets", lambda *a, **k: {"ok": True, "p1": 0.0, "p2": 0.5, "p3": 1.0, "errors": []})
    monkeypatch.setattr(ocrmod.stacks, "read_stacks", lambda *a, **k: {"ok": False, "errors": []})
    monkeypatch.setattr(ocrmod.names, "read_names", lambda *a, **k: {"ok": False, "errors": []})
    monkeypatch.setattr(ocrmod.villano, "classify_villano", lambda *a, **k: {"ok": False, "errors": []})

    table_state = {"ok": True, "players": 3, "is_hu": False, "is_3h": True, "active_seats": ["p1", "p2", "p3"], "errors": []}
    dealer = {"ok": True, "dealer_seat": "p1", "score": 0.91, "errors": []}

    monkeypatch.setattr(ocrmod.table_state, "compute_table_state", lambda *a, **k: table_state)
    monkeypatch.setattr(ocrmod.dealer, "read_dealer", lambda *a, **k: dealer)

    seen = {}

    def fake_posiciones(ts, bets, deal):
        seen["table_state"] = ts
        seen["bets"] = bets
        seen["dealer"] = deal
        return {"ok": True, "p1": "BTN", "p2": "SB", "p3": "BB", "errors": []}

    monkeypatch.setattr(ocrmod.posiciones, "read_posiciones", fake_posiciones)

    ocrmod.run_ocr("fake.bmp")

    assert seen["table_state"] == table_state
    assert seen["bets"]["p2"] == 0.5
    assert seen["dealer"] == dealer


def test_run_ocr_incluye_gamecode(monkeypatch):
    monkeypatch.setattr(ocrmod.bets, "read_bets", lambda *a, **k: {"ok": False, "errors": []})
    monkeypatch.setattr(ocrmod.stacks, "read_stacks", lambda *a, **k: {"ok": False, "errors": []})
    monkeypatch.setattr(ocrmod.names, "read_names", lambda *a, **k: {"ok": False, "errors": []})
    monkeypatch.setattr(ocrmod.villano, "classify_villano", lambda *a, **k: {"ok": False, "errors": []})
    monkeypatch.setattr(ocrmod.table_state, "compute_table_state", lambda *a, **k: {"ok": False, "errors": []})
    monkeypatch.setattr(ocrmod.dealer, "read_dealer", lambda *a, **k: {"ok": False, "errors": []})
    monkeypatch.setattr(ocrmod.posiciones, "read_posiciones", lambda *a, **k: {"ok": False, "errors": []})
    monkeypatch.setattr(
        ocrmod.gamecode,
        "read_gamecode",
        lambda *a, **k: {"ok": True, "value": "12104995598", "raw_text": "ID: 12104995598", "roi": (10, 20, 220, 32), "error": ""},
    )

    out = ocrmod.run_ocr("fake.bmp")

    assert "gamecode" in out
    assert out["gamecode"]["ok"] is True
    assert out["gamecode"]["value"] == "12104995598"
    assert out["gamecode"]["error"] == ""


def test_run_ocr_agrega_gamecode_error_singular(monkeypatch):
    monkeypatch.setattr(ocrmod.bets, "read_bets", lambda *a, **k: {"ok": False, "errors": []})
    monkeypatch.setattr(ocrmod.stacks, "read_stacks", lambda *a, **k: {"ok": False, "errors": []})
    monkeypatch.setattr(ocrmod.names, "read_names", lambda *a, **k: {"ok": False, "errors": []})
    monkeypatch.setattr(ocrmod.villano, "classify_villano", lambda *a, **k: {"ok": False, "errors": []})
    monkeypatch.setattr(ocrmod.table_state, "compute_table_state", lambda *a, **k: {"ok": False, "errors": []})
    monkeypatch.setattr(ocrmod.dealer, "read_dealer", lambda *a, **k: {"ok": False, "errors": []})
    monkeypatch.setattr(ocrmod.posiciones, "read_posiciones", lambda *a, **k: {"ok": False, "errors": []})
    monkeypatch.setattr(
        ocrmod.gamecode,
        "read_gamecode",
        lambda *a, **k: {"ok": False, "value": None, "raw_text": "", "roi": (10, 20, 220, 32), "error": "gamecode_not_found"},
    )

    out = ocrmod.run_ocr("fake.bmp")

    assert "gamecode:gamecode_not_found" in out["errors"]
