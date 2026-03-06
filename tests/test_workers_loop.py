import io
import sys
import types

import modules.preflop.workers_loop.loop_runner as loopmod


def _install_fake_imports(monkeypatch):
    fake_worker_mod = types.ModuleType("modules.workers.worker_preflop")
    fake_dbmod = types.SimpleNamespace()
    fake_db_pkg = types.ModuleType("modules.db")
    fake_db_pkg.db = fake_dbmod

    monkeypatch.setitem(sys.modules, "modules.workers.worker_preflop", fake_worker_mod)
    monkeypatch.setitem(sys.modules, "modules.db", fake_db_pkg)

    return fake_worker_mod, fake_dbmod


def test_run_loop_con_max_ticks_1_ejecuta_un_tick(monkeypatch, tmp_path):
    calls = {"n": 0}

    monkeypatch.setattr(loopmod, "ensure_dirs", lambda base_dir: {"base_dir": base_dir})
    monkeypatch.setattr(loopmod, "enable_fallback_env", lambda *a, **k: None)
    monkeypatch.setattr(loopmod, "_debug_enabled", lambda: False)
    monkeypatch.setattr(loopmod, "_pytest_fixed_input", lambda base_dir: None)
    monkeypatch.setattr(loopmod.time, "sleep", lambda *a, **k: None)

    def fake_run_one_tick(**kwargs):
        calls["n"] += 1

    monkeypatch.setattr(loopmod, "run_one_tick", fake_run_one_tick)
    _install_fake_imports(monkeypatch)

    fp = io.StringIO()
    loopmod.run_loop(
        out_dir=str(tmp_path),
        interval_ms=200,
        verbose=False,
        fp=fp,
        max_ticks=1,
    )

    assert calls["n"] == 1
    txt = fp.getvalue()
    assert "START run_workers_loop" in txt
    assert "TICK_START n=1" in txt
    assert "TICK_END n=1" in txt
    assert "END run_workers_loop ticks_done=1" in txt


def test_run_loop_con_max_ticks_2_ejecuta_dos_ticks(monkeypatch, tmp_path):
    calls = {"n": 0}

    monkeypatch.setattr(loopmod, "ensure_dirs", lambda base_dir: {"base_dir": base_dir})
    monkeypatch.setattr(loopmod, "enable_fallback_env", lambda *a, **k: None)
    monkeypatch.setattr(loopmod, "_debug_enabled", lambda: True)
    monkeypatch.setattr(loopmod, "_pytest_fixed_input", lambda base_dir: None)
    monkeypatch.setattr(loopmod.time, "sleep", lambda *a, **k: None)

    def fake_run_one_tick(**kwargs):
        calls["n"] += 1

    monkeypatch.setattr(loopmod, "run_one_tick", fake_run_one_tick)
    _install_fake_imports(monkeypatch)

    fp = io.StringIO()
    loopmod.run_loop(
        out_dir=str(tmp_path),
        interval_ms=200,
        verbose=True,
        fp=fp,
        max_ticks=2,
    )

    assert calls["n"] == 2
    txt = fp.getvalue()
    assert "TICK_START n=1" in txt
    assert "TICK_END n=1" in txt
    assert "TICK_START n=2" in txt
    assert "TICK_END n=2" in txt
    assert "END run_workers_loop ticks_done=2" in txt


def test_run_loop_si_run_one_tick_falla_loguea_y_sigue(monkeypatch, tmp_path):
    calls = {"n": 0}

    monkeypatch.setattr(loopmod, "ensure_dirs", lambda base_dir: {"base_dir": base_dir})
    monkeypatch.setattr(loopmod, "enable_fallback_env", lambda *a, **k: None)
    monkeypatch.setattr(loopmod, "_debug_enabled", lambda: False)
    monkeypatch.setattr(loopmod, "_pytest_fixed_input", lambda base_dir: None)
    monkeypatch.setattr(loopmod.time, "sleep", lambda *a, **k: None)

    def fake_run_one_tick(**kwargs):
        calls["n"] += 1
        if calls["n"] == 1:
            raise RuntimeError("boom")

    monkeypatch.setattr(loopmod, "run_one_tick", fake_run_one_tick)
    _install_fake_imports(monkeypatch)

    fp = io.StringIO()
    loopmod.run_loop(
        out_dir=str(tmp_path),
        interval_ms=200,
        verbose=False,
        fp=fp,
        max_ticks=2,
    )

    assert calls["n"] == 2
    txt = fp.getvalue()
    assert "TICK_ERROR n=1 err=RuntimeError:boom" in txt
    assert "TICK_END n=1" in txt
    assert "TICK_START n=2" in txt
    assert "TICK_END n=2" in txt


def test_run_loop_escribe_logs_de_inicio_y_fin(monkeypatch, tmp_path):
    monkeypatch.setattr(loopmod, "ensure_dirs", lambda base_dir: {"base_dir": base_dir})
    monkeypatch.setattr(loopmod, "enable_fallback_env", lambda *a, **k: None)
    monkeypatch.setattr(loopmod, "_debug_enabled", lambda: False)
    monkeypatch.setattr(loopmod, "_pytest_fixed_input", lambda base_dir: "fixed_input.bmp")
    monkeypatch.setattr(loopmod.time, "sleep", lambda *a, **k: None)
    monkeypatch.setattr(loopmod, "run_one_tick", lambda **kwargs: None)

    _install_fake_imports(monkeypatch)

    fp = io.StringIO()
    loopmod.run_loop(
        out_dir=str(tmp_path),
        interval_ms=200,
        verbose=False,
        fp=fp,
        max_ticks=1,
    )

    txt = fp.getvalue()
    assert "START run_workers_loop" in txt
    assert "PROJECT_ROOT=" in txt
    assert "POKER_BOSS_FALLBACK_SE=" in txt
    assert "END run_workers_loop ticks_done=1" in txt
