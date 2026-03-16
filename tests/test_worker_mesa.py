import io
import os
import json
import time
from types import SimpleNamespace

import modules.preflop.workers_loop.worker_mesa as wmod


def _make_dirs(tmp_path):
    base = tmp_path
    tmp_dir = base / "_tmp"
    ok_dir = base / "ok"
    err_dir = base / "no ok"
    del_dir = base / "no ok"

    tmp_dir.mkdir(parents=True, exist_ok=True)
    ok_dir.mkdir(parents=True, exist_ok=True)
    err_dir.mkdir(parents=True, exist_ok=True)

    return SimpleNamespace(
        tmp_dir=str(tmp_dir),
        ok_dir=str(ok_dir),
        err_dir=str(err_dir),
        del_dir=str(del_dir),
    )


def _write_file(path, content=b"bmp"):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as f:
        f.write(content)


def _make_cap_bmp(dirs, name="cap.bmp"):
    """Create a valid BMP so worker can crop time ROI (needs ~400x500)."""
    from PIL import Image as PILImage
    path = os.path.join(dirs.tmp_dir, name)
    PILImage.new("RGB", (400, 500), color=(0, 0, 0)).save(path, format="BMP")
    return path


def test_run_worker_mesa_once_skip_si_time_gate_false(monkeypatch, tmp_path):
    dirs = _make_dirs(tmp_path)
    fp = io.StringIO()

    # Single capture then time gate on cropped ROI; mock time gate to fail
    monkeypatch.setattr(
        wmod,
        "run_time_gate_on_roi_path",
        lambda *a, **k: {"time_ok": False, "score": 0.1, "reason": "clock_not_visible"},
    )

    called = {"capture": 0, "insert": 0}
    cap_path = _make_cap_bmp(dirs)

    def _capture(*a, **k):
        called["capture"] += 1
        return cap_path

    monkeypatch.setattr(wmod, "capture_to_tmp", _capture)
    dbmod = SimpleNamespace(
        find_recent_capture_by_fingerprint=lambda **k: None,
        insert_worker_capture=lambda **k: called.__setitem__("insert", called["insert"] + 1),
    )

    wmod.run_worker_mesa_once(
        area={"mesa": 1, "x1": 0, "y1": 0, "ancho": 10, "alto": 10},
        dirs=dirs,
        ts="20260306_120000_000000",
        interval_ms=300,
        verbose=False,
        fp=fp,
        fixed_input=None,
        last_sig_by_mesa={},
        dbg=True,
        dbmod=dbmod,
        MatchInput=None,
        select_move=None,
        extract_modules_fn=lambda *a, **k: ({}, {}),
        build_ocr_safe_fn=lambda *a, **k: {},
        compute_strategy_safe_fn=lambda *a, **k: ({}, None),
    )

    assert called["capture"] == 1
    assert called["insert"] == 0
    assert "TIME FALSE -> skip" in fp.getvalue()


def test_run_worker_mesa_once_skip_duplicado_por_fingerprint(monkeypatch, tmp_path):
    dirs = _make_dirs(tmp_path)
    fp = io.StringIO()

    img_path = _make_cap_bmp(dirs)

    monkeypatch.setattr(wmod, "run_time_gate_on_roi_path", lambda *a, **k: {"time_ok": True})
    monkeypatch.setattr(wmod, "capture_to_tmp", lambda *a, **k: img_path)
    monkeypatch.setattr(wmod, "get_file_fingerprint", lambda p: "fp_dup")

    db_calls = {"insert": 0}

    dbmod = SimpleNamespace(
        find_recent_capture_by_fingerprint=lambda **k: {"capture_id": 99, "status": "ok"},
        insert_worker_capture=lambda **k: db_calls.__setitem__("insert", db_calls["insert"] + 1),
    )

    wmod.run_worker_mesa_once(
        area={"mesa": 2, "x1": 0, "y1": 0, "ancho": 10, "alto": 10},
        dirs=dirs,
        ts="20260306_120000_000000",
        interval_ms=300,
        verbose=False,
        fp=fp,
        fixed_input=None,
        last_sig_by_mesa={},
        dbg=True,
        dbmod=dbmod,
        MatchInput=None,
        select_move=None,
        extract_modules_fn=lambda *a, **k: ({}, {}),
        build_ocr_safe_fn=lambda *a, **k: {},
        compute_strategy_safe_fn=lambda *a, **k: ({}, None),
    )

    assert db_calls["insert"] == 0
    assert not os.path.exists(img_path)
    assert "DUPLICATE CAPTURE -> skip" in fp.getvalue()


def test_run_worker_mesa_once_guarda_capture_y_ocr(monkeypatch, tmp_path):
    dirs = _make_dirs(tmp_path)
    fp = io.StringIO()

    img_path = _make_cap_bmp(dirs)

    monkeypatch.setattr(wmod, "run_time_gate_on_roi_path", lambda *a, **k: {"time_ok": True})
    monkeypatch.setattr(wmod, "capture_to_tmp", lambda *a, **k: img_path)
    monkeypatch.setattr(wmod, "get_file_fingerprint", lambda p: "fp_ocr")
    monkeypatch.setattr(wmod, "run_ocr", lambda p: {"ok": True, "names": {"ok": True, "p2_name": "A", "p3_name": "B"}})
    monkeypatch.setattr(wmod, "_run_preflop_direct", lambda p: {"preflop_ok": False, "error": "hero_not_detected"})
    monkeypatch.setattr(wmod, "preflop_fail", lambda preflop: True)
    monkeypatch.setattr(wmod, "safe_move", lambda src, dst_dir: os.path.join(dst_dir, os.path.basename(src)))

    seen = {"insert": None, "ocr": None, "route": None}

    def insert_worker_capture(**kwargs):
        seen["insert"] = kwargs
        return 123

    def update_worker_capture_ocr(**kwargs):
        seen["ocr"] = kwargs
        return True

    def update_worker_capture_route(**kwargs):
        seen["route"] = kwargs
        return True

    dbmod = SimpleNamespace(
        find_recent_capture_by_fingerprint=lambda **k: None,
        insert_worker_capture=insert_worker_capture,
        update_worker_capture_ocr=update_worker_capture_ocr,
        update_worker_capture_route=update_worker_capture_route,
    )

    wmod.run_worker_mesa_once(
        area={"mesa": 3, "x1": 0, "y1": 0, "ancho": 10, "alto": 10},
        dirs=dirs,
        ts="20260306_120000_000000",
        interval_ms=300,
        verbose=False,
        fp=fp,
        fixed_input=None,
        last_sig_by_mesa={},
        dbg=False,
        dbmod=dbmod,
        MatchInput=None,
        select_move=None,
        extract_modules_fn=lambda *a, **k: ({}, {}),
        build_ocr_safe_fn=lambda *a, **k: {},
        compute_strategy_safe_fn=lambda *a, **k: ({}, None),
    )

    assert seen["insert"] is not None
    assert seen["insert"]["mesa"] == 3
    assert seen["insert"]["image_fingerprint"] == "fp_ocr"
    assert seen["ocr"] is not None
    assert seen["ocr"]["capture_id"] == 123
    assert seen["ocr"]["ocr_ok"] is True
    assert '"p2_name": "A"' in seen["ocr"]["ocr_json"]


def test_run_worker_mesa_once_preflop_fail_mueve_a_borrar_y_actualiza_db(monkeypatch, tmp_path):
    dirs = _make_dirs(tmp_path)
    fp = io.StringIO()

    img_path = _make_cap_bmp(dirs)

    monkeypatch.setattr(wmod, "run_time_gate_on_roi_path", lambda *a, **k: {"time_ok": True})
    monkeypatch.setattr(wmod, "capture_to_tmp", lambda *a, **k: img_path)
    monkeypatch.setattr(wmod, "get_file_fingerprint", lambda p: "fp_preflop_fail")
    monkeypatch.setattr(wmod, "run_ocr", lambda p: {"ok": True})
    monkeypatch.setattr(wmod, "_run_preflop_direct", lambda p: {"preflop_ok": False, "error": "layout_not_supported"})
    monkeypatch.setattr(wmod, "preflop_fail", lambda preflop: True)

    def fake_safe_move(src, dst_dir):
        dst = os.path.join(dst_dir, os.path.basename(src))
        return dst

    monkeypatch.setattr(wmod, "safe_move", fake_safe_move)

    wrote_debug = {"called": False}
    monkeypatch.setattr(wmod, "_write_preflop_fail_debug", lambda *a, **k: wrote_debug.__setitem__("called", True))

    seen = {"route": None}

    dbmod = SimpleNamespace(
        find_recent_capture_by_fingerprint=lambda **k: None,
        insert_worker_capture=lambda **k: 777,
        update_worker_capture_ocr=lambda **k: True,
        update_worker_capture_route=lambda **k: seen.__setitem__("route", kwargs_copy(k)) or True,
    )

    wmod.run_worker_mesa_once(
        area={"mesa": 1, "x1": 0, "y1": 0, "ancho": 10, "alto": 10},
        dirs=dirs,
        ts="20260306_120000_000000",
        interval_ms=300,
        verbose=False,
        fp=fp,
        fixed_input=None,
        last_sig_by_mesa={},
        dbg=False,
        dbmod=dbmod,
        MatchInput=None,
        select_move=None,
        extract_modules_fn=lambda *a, **k: ({}, {}),
        build_ocr_safe_fn=lambda *a, **k: {},
        compute_strategy_safe_fn=lambda *a, **k: ({}, None),
    )

    txt = fp.getvalue()
    assert "preflop FAIL -> borrar" in txt
    assert "layout_not_supported" in txt
    assert wrote_debug["called"] is True
    assert seen["route"] is not None
    assert seen["route"]["capture_id"] == 777
    assert seen["route"]["status"] == "borrar"


def test_run_worker_mesa_once_strategy_ok_mueve_a_ok(monkeypatch, tmp_path):
    dirs = _make_dirs(tmp_path)
    fp = io.StringIO()

    img_path = _make_cap_bmp(dirs)

    monkeypatch.setattr(wmod, "run_time_gate_on_roi_path", lambda *a, **k: {"time_ok": True})
    monkeypatch.setattr(wmod, "capture_to_tmp", lambda *a, **k: img_path)
    monkeypatch.setattr(wmod, "get_file_fingerprint", lambda p: "fp_ok")
    monkeypatch.setattr(wmod, "run_ocr", lambda p: {"ok": True})
    monkeypatch.setattr(wmod, "_run_preflop_direct", lambda p: {"preflop_ok": True, "hero_cards": "AsKs"})
    monkeypatch.setattr(wmod, "preflop_fail", lambda preflop: False)
    monkeypatch.setattr(wmod, "force_ok_on_default_fold", lambda strategy: strategy)
    monkeypatch.setattr(wmod, "has_strategy_move", lambda strategy: True)
    monkeypatch.setattr(wmod, "safe_move", lambda src, dst_dir: os.path.join(dst_dir, os.path.basename(src)))
    monkeypatch.setattr(wmod, "process_one_image", lambda **kwargs: ({"ok": True}, "sig_new"))

    seen = {"route": None}
    dbmod = SimpleNamespace(
        find_recent_capture_by_fingerprint=lambda **k: None,
        insert_worker_capture=lambda **k: 500,
        update_worker_capture_ocr=lambda **k: True,
        update_worker_capture_route=lambda **k: seen.__setitem__("route", kwargs_copy(k)) or True,
    )

    last_sig_by_mesa = {1: None}

    wmod.run_worker_mesa_once(
        area={"mesa": 1, "x1": 0, "y1": 0, "ancho": 10, "alto": 10},
        dirs=dirs,
        ts="20260306_120000_000000",
        interval_ms=300,
        verbose=True,
        fp=fp,
        fixed_input=None,
        last_sig_by_mesa=last_sig_by_mesa,
        dbg=False,
        dbmod=dbmod,
        MatchInput=None,
        select_move=None,
        extract_modules_fn=lambda preflop: ({"mano": 1}, {"stacks": 1}),
        build_ocr_safe_fn=lambda *a, **k: {},
        compute_strategy_safe_fn=lambda preflop, mano_result, ocr: ({"action": "raise"}, None),
    )

    assert seen["route"] is not None
    assert seen["route"]["status"] == "ok"
    assert seen["route"]["reason"] == "strategy_has_move_and_bets"
    assert last_sig_by_mesa[1] == "sig_new"
    assert "OK -> ok:" in fp.getvalue()


def test_run_worker_mesa_once_no_strategy_mueve_a_errors(monkeypatch, tmp_path):
    dirs = _make_dirs(tmp_path)
    fp = io.StringIO()

    img_path = _make_cap_bmp(dirs)

    monkeypatch.setattr(wmod, "run_time_gate_on_roi_path", lambda *a, **k: {"time_ok": True})
    monkeypatch.setattr(wmod, "capture_to_tmp", lambda *a, **k: img_path)
    monkeypatch.setattr(wmod, "get_file_fingerprint", lambda p: "fp_err")
    monkeypatch.setattr(wmod, "run_ocr", lambda p: {"ok": True})
    monkeypatch.setattr(wmod, "_run_preflop_direct", lambda p: {"preflop_ok": True})
    monkeypatch.setattr(wmod, "preflop_fail", lambda preflop: False)
    monkeypatch.setattr(wmod, "force_ok_on_default_fold", lambda strategy: strategy)
    monkeypatch.setattr(wmod, "has_strategy_move", lambda strategy: False)
    monkeypatch.setattr(wmod, "safe_move", lambda src, dst_dir: os.path.join(dst_dir, os.path.basename(src)))
    monkeypatch.setattr(wmod, "process_one_image", lambda **kwargs: ({"ok": False}, "sig_err"))

    seen = {"route": None}
    dbmod = SimpleNamespace(
        find_recent_capture_by_fingerprint=lambda **k: None,
        insert_worker_capture=lambda **k: 600,
        update_worker_capture_ocr=lambda **k: True,
        update_worker_capture_route=lambda **k: seen.__setitem__("route", kwargs_copy(k)) or True,
    )

    wmod.run_worker_mesa_once(
        area={"mesa": 4, "x1": 0, "y1": 0, "ancho": 10, "alto": 10},
        dirs=dirs,
        ts="20260306_120000_000000",
        interval_ms=300,
        verbose=True,
        fp=fp,
        fixed_input=None,
        last_sig_by_mesa={4: None},
        dbg=False,
        dbmod=dbmod,
        MatchInput=None,
        select_move=None,
        extract_modules_fn=lambda preflop: ({}, {}),
        build_ocr_safe_fn=lambda *a, **k: {},
        compute_strategy_safe_fn=lambda preflop, mano_result, ocr: ({"error": "no_range_found"}, "fallback_err"),
    )

    assert seen["route"] is not None
    assert seen["route"]["status"] == "errors"
    assert seen["route"]["reason"] == "no_range_found"
    assert "NO STRATEGY -> errors:" in fp.getvalue()


def test_run_worker_mesa_once_si_falla_capture_ocr_loguea_y_sale(monkeypatch, tmp_path):
    dirs = _make_dirs(tmp_path)
    fp = io.StringIO()

    img_path = _make_cap_bmp(dirs)

    monkeypatch.setattr(wmod, "run_time_gate_on_roi_path", lambda *a, **k: {"time_ok": True})
    monkeypatch.setattr(wmod, "capture_to_tmp", lambda *a, **k: img_path)
    monkeypatch.setattr(wmod, "get_file_fingerprint", lambda p: "fp_bad")
    monkeypatch.setattr(wmod, "run_ocr", lambda p: (_ for _ in ()).throw(RuntimeError("ocr_boom")))
    monkeypatch.setattr(wmod, "_run_preflop_direct", lambda p: {"preflop_ok": True})
    monkeypatch.setattr(wmod, "preflop_fail", lambda preflop: False)
    monkeypatch.setattr(wmod, "has_strategy_move", lambda strategy: False)
    monkeypatch.setattr(wmod, "safe_move", lambda src, dst_dir: os.path.join(dst_dir, os.path.basename(src)))
    monkeypatch.setattr(wmod, "process_one_image", lambda **kwargs: ({"ok": False}, "sig_err"))

    seen_ocr = {}
    dbmod = SimpleNamespace(
        find_recent_capture_by_fingerprint=lambda **k: None,
        insert_worker_capture=lambda **k: 900,
        update_worker_capture_ocr=lambda **k: seen_ocr.update(k) or True,
        update_worker_capture_route=lambda **k: True,
    )

    wmod.run_worker_mesa_once(
        area={"mesa": 2, "x1": 0, "y1": 0, "ancho": 10, "alto": 10},
        dirs=dirs,
        ts="20260306_120000_000000",
        interval_ms=300,
        verbose=False,
        fp=fp,
        fixed_input=None,
        last_sig_by_mesa={},
        dbg=False,
        dbmod=dbmod,
        MatchInput=None,
        select_move=None,
        extract_modules_fn=lambda *a, **k: ({}, {}),
        build_ocr_safe_fn=lambda *a, **k: {},
        compute_strategy_safe_fn=lambda *a, **k: ({}, None),
    )

    # OCR exception is caught and stored; deferred update runs in background thread
    time.sleep(0.2)
    assert seen_ocr.get("ocr_ok") is False
    assert "ocr_boom" in (seen_ocr.get("ocr_json") or "")


def test_run_worker_mesa_once_profiles_and_inserts_worker_profile(monkeypatch, tmp_path):
    dirs = _make_dirs(tmp_path)
    fp = io.StringIO()

    img_path = _make_cap_bmp(dirs)

    monkeypatch.setenv("POKER_BOSS_WORKER_PROFILE", "1")
    monkeypatch.setenv("POKER_BOSS_WORKER_SEQUENTIAL", "1")

    # time gate OK
    monkeypatch.setattr(wmod, "run_time_gate_on_roi_path", lambda *a, **k: {"time_ok": True})
    monkeypatch.setattr(wmod, "capture_to_tmp", lambda *a, **k: img_path)
    monkeypatch.setattr(wmod, "get_file_fingerprint", lambda p: "fp_prof")
    # OCR y preflop sencillos
    monkeypatch.setattr(wmod, "run_ocr", lambda p: {"ok": True})
    monkeypatch.setattr(wmod, "_run_preflop_direct", lambda p: {"preflop_ok": True})
    monkeypatch.setattr(wmod, "preflop_fail", lambda preflop: False)
    monkeypatch.setattr(wmod, "force_ok_on_default_fold", lambda strategy: {"ok": True})
    monkeypatch.setattr(wmod, "has_strategy_move", lambda strategy: True)
    monkeypatch.setattr(wmod, "safe_move", lambda src, dst_dir: os.path.join(dst_dir, os.path.basename(src)))
    monkeypatch.setattr(wmod, "process_one_image", lambda **kwargs: ({"ok": True, "persisted": False}, "sig_prof"))

    captured_metrics = {}

    def insert_worker_profile(**kwargs):
        captured_metrics.update(kwargs)

    dbmod = SimpleNamespace(
        find_recent_capture_by_fingerprint=lambda **k: None,
        insert_worker_capture=lambda **k: 42,
        update_worker_capture_ocr=lambda **k: True,
        update_worker_capture_route=lambda **k: True,
        insert_worker_profile=insert_worker_profile,
    )

    last_sig_by_mesa = {1: None}

    wmod.run_worker_mesa_once(
        area={"mesa": 1, "x1": 0, "y1": 0, "ancho": 10, "alto": 10},
        dirs=dirs,
        ts="20260306_120000_000000",
        interval_ms=300,
        verbose=False,
        fp=fp,
        fixed_input=None,
        last_sig_by_mesa=last_sig_by_mesa,
        dbg=False,
        dbmod=dbmod,
        MatchInput=None,
        select_move=None,
        extract_modules_fn=lambda preflop: ({}, {}),
        build_ocr_safe_fn=lambda *a, **k: {},
        compute_strategy_safe_fn=lambda preflop, mano_result, ocr: ({"ok": True}, None),
    )

    # Debe haberse llamado insert_worker_profile con métricas de profiling
    assert captured_metrics
    assert captured_metrics.get("mesa") == 1
    assert captured_metrics.get("capture_id") == 42
    metrics = captured_metrics.get("metrics") or {}
    # Las claves principales de tiempo deben existir y ser floats
    for key in [
        "time_gate",
        "capture",
        "fp_db",
        "ocr",
        "preflop",
        "copy_capture",
        "extract",
        "insert_spot",
        "strategy",
        "obs",
        "time_sec",
        "total",
    ]:
        assert key in metrics
        assert isinstance(metrics[key], float)


def kwargs_copy(d):
    return dict(d)
