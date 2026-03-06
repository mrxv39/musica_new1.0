import io

import modules.preflop.workers_loop.tick_runner as tickmod


def test_run_one_tick_procesa_areas_esperadas(monkeypatch):
    calls = []

    monkeypatch.setattr(
        tickmod,
        "AREAS",
        [
            {"mesa": 1, "x1": 10, "y1": 20, "ancho": 100, "alto": 200},
            {"mesa": 2, "x1": 30, "y1": 40, "ancho": 100, "alto": 200},
            {"mesa": 3, "x1": 50, "y1": 60, "ancho": 100, "alto": 200},
        ],
    )

    def fake_run_worker_mesa_once(**kwargs):
        calls.append(kwargs["area"]["mesa"])

    monkeypatch.setattr(tickmod, "run_worker_mesa_once", fake_run_worker_mesa_once)

    fp = io.StringIO()
    tickmod.run_one_tick(
        dirs={"base_dir": "x"},
        ts="20260306_120000_000000",
        interval_ms=300,
        verbose=False,
        fp=fp,
        fixed_input=None,
        last_sig_by_mesa={},
        dbg=False,
        worker_preflop_mod=object(),
        dbmod=object(),
        MatchInput=None,
        select_move=None,
        extract_modules_fn=lambda *a, **k: {},
        build_ocr_safe_fn=lambda *a, **k: {},
        compute_strategy_safe_fn=lambda *a, **k: {},
    )

    assert calls == [1, 2, 3]


def test_run_one_tick_si_falla_una_area_propaga_excepcion(monkeypatch):
    calls = []

    monkeypatch.setattr(
        tickmod,
        "AREAS",
        [
            {"mesa": 1, "x1": 10, "y1": 20, "ancho": 100, "alto": 200},
            {"mesa": 2, "x1": 30, "y1": 40, "ancho": 100, "alto": 200},
            {"mesa": 3, "x1": 50, "y1": 60, "ancho": 100, "alto": 200},
        ],
    )

    def fake_run_worker_mesa_once(**kwargs):
        mesa = kwargs["area"]["mesa"]
        calls.append(mesa)
        if mesa == 2:
            raise RuntimeError("mesa_fail")

    monkeypatch.setattr(tickmod, "run_worker_mesa_once", fake_run_worker_mesa_once)

    fp = io.StringIO()

    try:
        tickmod.run_one_tick(
            dirs={"base_dir": "x"},
            ts="20260306_120000_000000",
            interval_ms=300,
            verbose=False,
            fp=fp,
            fixed_input=None,
            last_sig_by_mesa={},
            dbg=False,
            worker_preflop_mod=object(),
            dbmod=object(),
            MatchInput=None,
            select_move=None,
            extract_modules_fn=lambda *a, **k: {},
            build_ocr_safe_fn=lambda *a, **k: {},
            compute_strategy_safe_fn=lambda *a, **k: {},
        )
        assert False, "Se esperaba RuntimeError"
    except RuntimeError as e:
        assert str(e) == "mesa_fail"

    assert calls == [1, 2]


def test_run_one_tick_pasa_last_sig_by_mesa_y_area(monkeypatch):
    seen = {}

    monkeypatch.setattr(
        tickmod,
        "AREAS",
        [
            {"mesa": 1, "x1": 10, "y1": 20, "ancho": 100, "alto": 200},
        ],
    )

    def fake_run_worker_mesa_once(**kwargs):
        seen["last_sig_by_mesa"] = kwargs["last_sig_by_mesa"]
        seen["mesa"] = kwargs["area"]["mesa"]
        seen["fixed_input"] = kwargs["fixed_input"]
        seen["dbg"] = kwargs["dbg"]

    monkeypatch.setattr(tickmod, "run_worker_mesa_once", fake_run_worker_mesa_once)

    fp = io.StringIO()
    last_sig_by_mesa = {1: "sig_abc"}

    tickmod.run_one_tick(
        dirs={"base_dir": "x"},
        ts="20260306_120000_000000",
        interval_ms=300,
        verbose=False,
        fp=fp,
        fixed_input="fixed.bmp",
        last_sig_by_mesa=last_sig_by_mesa,
        dbg=True,
        worker_preflop_mod=object(),
        dbmod=object(),
        MatchInput=None,
        select_move=None,
        extract_modules_fn=lambda *a, **k: {},
        build_ocr_safe_fn=lambda *a, **k: {},
        compute_strategy_safe_fn=lambda *a, **k: {},
    )

    assert seen["mesa"] == 1
    assert seen["last_sig_by_mesa"] is last_sig_by_mesa
    assert seen["last_sig_by_mesa"][1] == "sig_abc"
    assert seen["fixed_input"] == "fixed.bmp"
    assert seen["dbg"] is True
