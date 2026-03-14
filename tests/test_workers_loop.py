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


def test_run_loop_ejecuta_linker_en_cada_tick_e_import_cada_n_ticks(monkeypatch, tmp_path):
    calls = {"tick": 0, "import": [], "link": [], "spot_link": []}

    monkeypatch.setattr(loopmod, "ensure_dirs", lambda base_dir: {"base_dir": base_dir})
    monkeypatch.setattr(loopmod, "enable_fallback_env", lambda *a, **k: None)
    monkeypatch.setattr(loopmod, "_debug_enabled", lambda: False)
    monkeypatch.setattr(loopmod, "_pytest_fixed_input", lambda base_dir: None)
    monkeypatch.setattr(loopmod.time, "sleep", lambda *a, **k: None)
    monkeypatch.setenv("POKER_BOSS_DB_PATH", str(tmp_path / "db.sqlite"))
    monkeypatch.setenv("POKER_BOSS_XML_DIR", str(tmp_path / "xml"))
    monkeypatch.setenv("POKER_BOSS_HERO", "Hero")
    monkeypatch.setenv("POKER_BOSS_SYNC_EVERY_TICKS", "2")

    monkeypatch.setattr(loopmod, "run_one_tick", lambda **kwargs: calls.__setitem__("tick", calls["tick"] + 1))
    _install_fake_imports(monkeypatch)

    fake_importer_mod = types.ModuleType("modules.importers.championpoker_xml_importer")
    fake_importer_mod.import_xml_folder = lambda **kwargs: calls["import"].append(kwargs) or {"ok": True}
    fake_linker_mod = types.ModuleType("modules.preflop.link_hands_obs_to_real")
    fake_linker_mod.link_hands_obs_to_real = lambda **kwargs: calls["link"].append(kwargs) or {"links_created": 3}
    fake_spot_linker_mod = types.ModuleType("modules.preflop.link_hands_obs_to_spots_xml_real")
    fake_spot_linker_mod.link_obs_to_spots = lambda **kwargs: calls["spot_link"].append(kwargs) or {"linked": 2}
    monkeypatch.setitem(sys.modules, "modules.importers.championpoker_xml_importer", fake_importer_mod)
    monkeypatch.setitem(sys.modules, "modules.preflop.link_hands_obs_to_real", fake_linker_mod)
    monkeypatch.setitem(sys.modules, "modules.preflop.link_hands_obs_to_spots_xml_real", fake_spot_linker_mod)

    fp = io.StringIO()
    loopmod.run_loop(
        out_dir=str(tmp_path),
        interval_ms=200,
        verbose=False,
        fp=fp,
        max_ticks=3,
    )

    assert calls["tick"] == 3
    assert len(calls["link"]) == 3
    assert len(calls["spot_link"]) == 3
    assert len(calls["import"]) == 1
    assert calls["import"][0]["room"] == "championpoker"
    assert calls["import"][0]["hero"] == "Hero"
    assert calls["import"][0]["db_path"] == str(tmp_path / "db.sqlite")
    assert calls["link"][0]["db_path"] == str(tmp_path / "db.sqlite")
    assert calls["spot_link"][0]["db_path"] == str(tmp_path / "db.sqlite")
    txt = fp.getvalue()
    assert "SYNC_IMPORT_XML tick=2" in txt
    assert "SYNC_LINK_HANDS_OBS_TO_REAL tick=1 links_created=3" in txt
    assert "SYNC_LINK_SPOTS_XML_REAL tick=1 linked=2" in txt


def test_run_loop_loguea_errores_de_sync_y_sigue(monkeypatch, tmp_path):
    monkeypatch.setattr(loopmod, "ensure_dirs", lambda base_dir: {"base_dir": base_dir})
    monkeypatch.setattr(loopmod, "enable_fallback_env", lambda *a, **k: None)
    monkeypatch.setattr(loopmod, "_debug_enabled", lambda: False)
    monkeypatch.setattr(loopmod, "_pytest_fixed_input", lambda base_dir: None)
    monkeypatch.setattr(loopmod.time, "sleep", lambda *a, **k: None)
    monkeypatch.setenv("POKER_BOSS_DB_PATH", str(tmp_path / "db.sqlite"))
    monkeypatch.setenv("POKER_BOSS_XML_DIR", str(tmp_path / "xml"))
    monkeypatch.setenv("POKER_BOSS_HERO", "Hero")
    monkeypatch.setenv("POKER_BOSS_SYNC_EVERY_TICKS", "1")
    monkeypatch.setattr(loopmod, "run_one_tick", lambda **kwargs: None)
    _install_fake_imports(monkeypatch)

    fake_importer_mod = types.ModuleType("modules.importers.championpoker_xml_importer")
    fake_linker_mod = types.ModuleType("modules.preflop.link_hands_obs_to_real")
    fake_spot_linker_mod = types.ModuleType("modules.preflop.link_hands_obs_to_spots_xml_real")

    def boom_import(**kwargs):
        raise RuntimeError("import failed")

    def boom_link(**kwargs):
        raise RuntimeError("link failed")

    def boom_spot_link(**kwargs):
        raise RuntimeError("spot link failed")

    fake_importer_mod.import_xml_folder = boom_import
    fake_linker_mod.link_hands_obs_to_real = boom_link
    fake_spot_linker_mod.link_obs_to_spots = boom_spot_link
    monkeypatch.setitem(sys.modules, "modules.importers.championpoker_xml_importer", fake_importer_mod)
    monkeypatch.setitem(sys.modules, "modules.preflop.link_hands_obs_to_real", fake_linker_mod)
    monkeypatch.setitem(sys.modules, "modules.preflop.link_hands_obs_to_spots_xml_real", fake_spot_linker_mod)

    fp = io.StringIO()
    loopmod.run_loop(
        out_dir=str(tmp_path),
        interval_ms=200,
        verbose=False,
        fp=fp,
        max_ticks=1,
    )

    txt = fp.getvalue()
    assert "SYNC_IMPORT_XML_ERROR tick=1 err=RuntimeError:import failed" in txt
    assert "SYNC_LINK_HANDS_OBS_TO_REAL_ERROR tick=1 err=RuntimeError:link failed" in txt
    assert "SYNC_LINK_SPOTS_XML_REAL_ERROR tick=1 err=RuntimeError:spot link failed" in txt
    assert "END run_workers_loop ticks_done=1" in txt


def test_run_loop_sin_xml_dir_solo_ejecuta_linker(monkeypatch, tmp_path):
    calls = {"tick": 0, "import": [], "link": [], "spot_link": []}

    monkeypatch.setattr(loopmod, "ensure_dirs", lambda base_dir: {"base_dir": base_dir})
    monkeypatch.setattr(loopmod, "enable_fallback_env", lambda *a, **k: None)
    monkeypatch.setattr(loopmod, "_debug_enabled", lambda: False)
    monkeypatch.setattr(loopmod, "_pytest_fixed_input", lambda base_dir: None)
    monkeypatch.setattr(loopmod.time, "sleep", lambda *a, **k: None)
    monkeypatch.setenv("POKER_BOSS_DB_PATH", str(tmp_path / "db.sqlite"))
    monkeypatch.setenv("POKER_BOSS_XML_DIR", "")
    monkeypatch.setenv("POKER_BOSS_HERO", "Hero")
    monkeypatch.setenv("POKER_BOSS_SYNC_EVERY_TICKS", "1")
    monkeypatch.setattr(loopmod, "run_one_tick", lambda **kwargs: calls.__setitem__("tick", calls["tick"] + 1))
    _install_fake_imports(monkeypatch)

    fake_importer_mod = types.ModuleType("modules.importers.championpoker_xml_importer")
    fake_importer_mod.import_xml_folder = lambda **kwargs: calls["import"].append(kwargs) or {"ok": True}
    fake_linker_mod = types.ModuleType("modules.preflop.link_hands_obs_to_real")
    fake_linker_mod.link_hands_obs_to_real = lambda **kwargs: calls["link"].append(kwargs) or {"links_created": 1}
    fake_spot_linker_mod = types.ModuleType("modules.preflop.link_hands_obs_to_spots_xml_real")
    fake_spot_linker_mod.link_obs_to_spots = lambda **kwargs: calls["spot_link"].append(kwargs) or {"linked": 1}
    monkeypatch.setitem(sys.modules, "modules.importers.championpoker_xml_importer", fake_importer_mod)
    monkeypatch.setitem(sys.modules, "modules.preflop.link_hands_obs_to_real", fake_linker_mod)
    monkeypatch.setitem(sys.modules, "modules.preflop.link_hands_obs_to_spots_xml_real", fake_spot_linker_mod)

    fp = io.StringIO()
    loopmod.run_loop(
        out_dir=str(tmp_path),
        interval_ms=200,
        verbose=False,
        fp=fp,
        max_ticks=2,
    )

    assert calls["tick"] == 2
    assert calls["import"] == []
    assert len(calls["link"]) == 2
    assert len(calls["spot_link"]) == 2
    assert all(call["db_path"] == str(tmp_path / "db.sqlite") for call in calls["link"])


def test_run_loop_sin_db_path_loguea_sync_skipped(monkeypatch, tmp_path):
    calls = {"import": 0, "link": 0, "spot_link": 0}

    monkeypatch.setattr(loopmod, "ensure_dirs", lambda base_dir: {"base_dir": base_dir})
    monkeypatch.setattr(loopmod, "enable_fallback_env", lambda *a, **k: None)
    monkeypatch.setattr(loopmod, "_debug_enabled", lambda: False)
    monkeypatch.setattr(loopmod, "_pytest_fixed_input", lambda base_dir: None)
    monkeypatch.setattr(loopmod.time, "sleep", lambda *a, **k: None)
    monkeypatch.delenv("POKER_BOSS_DB_PATH", raising=False)
    monkeypatch.delenv("MUSICA_DB_PATH", raising=False)
    monkeypatch.setenv("POKER_BOSS_XML_DIR", str(tmp_path / "xml"))
    monkeypatch.setenv("POKER_BOSS_HERO", "Hero")
    monkeypatch.setattr(loopmod, "run_one_tick", lambda **kwargs: None)
    _install_fake_imports(monkeypatch)

    fake_importer_mod = types.ModuleType("modules.importers.championpoker_xml_importer")
    fake_importer_mod.import_xml_folder = lambda **kwargs: calls.__setitem__("import", calls["import"] + 1)
    fake_linker_mod = types.ModuleType("modules.preflop.link_hands_obs_to_real")
    fake_linker_mod.link_hands_obs_to_real = lambda **kwargs: calls.__setitem__("link", calls["link"] + 1)
    fake_spot_linker_mod = types.ModuleType("modules.preflop.link_hands_obs_to_spots_xml_real")
    fake_spot_linker_mod.link_obs_to_spots = lambda **kwargs: calls.__setitem__("spot_link", calls["spot_link"] + 1)
    monkeypatch.setitem(sys.modules, "modules.importers.championpoker_xml_importer", fake_importer_mod)
    monkeypatch.setitem(sys.modules, "modules.preflop.link_hands_obs_to_real", fake_linker_mod)
    monkeypatch.setitem(sys.modules, "modules.preflop.link_hands_obs_to_spots_xml_real", fake_spot_linker_mod)

    fp = io.StringIO()
    loopmod.run_loop(
        out_dir=str(tmp_path),
        interval_ms=200,
        verbose=False,
        fp=fp,
        max_ticks=1,
    )

    txt = fp.getvalue()
    assert "SYNC_SKIPPED" in txt
    assert "missing_db_path" in txt
    assert calls["import"] == 0
    assert calls["link"] == 0
    assert calls["spot_link"] == 0
