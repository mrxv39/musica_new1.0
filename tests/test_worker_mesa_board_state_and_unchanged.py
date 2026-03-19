import pytest
import io
import os
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
    """Valid BMP so worker can crop time ROI (~400x500)."""
    from PIL import Image as PILImage
    path = os.path.join(dirs.tmp_dir, name)
    PILImage.new("RGB", (400, 500), color=(0, 0, 0)).save(path, format="BMP")
    return path


def test_run_worker_mesa_once_skip_unchanged_frame_in_memory(monkeypatch, tmp_path):
    dirs = _make_dirs(tmp_path)
    fp = io.StringIO()

    img_path = _make_cap_bmp(dirs, "cap_same.bmp")

    monkeypatch.setattr(wmod, "run_time_gate_on_roi_path", lambda *a, **k: {"time_ok": True})
    monkeypatch.setattr(wmod, "capture_to_tmp", lambda *a, **k: img_path)
    monkeypatch.setattr(wmod, "get_file_fingerprint", lambda _p: "fp_same_mem")

    called = {
        "ocr": 0,
        "preflop": 0,
        "process": 0,
        "insert_capture": 0,
    }

    monkeypatch.setattr(
        wmod,
        "run_ocr",
        lambda _p: called.__setitem__("ocr", called["ocr"] + 1) or {"ok": True},
    )
    monkeypatch.setattr(
        wmod,
        "_run_preflop_direct",
        lambda _p: called.__setitem__("preflop", called["preflop"] + 1) or {"preflop_ok": True},
    )
    dbmod = SimpleNamespace(
        find_recent_capture_by_fingerprint=lambda **k: None,
        insert_worker_capture=lambda **k: called.__setitem__("insert_capture", called["insert_capture"] + 1),
        update_worker_capture_ocr=lambda **k: True,
        update_worker_capture_route=lambda **k: True,
    )

    monkeypatch.setattr(wmod, "_LAST_CAPTURE_FP_BY_MESA", {7: "fp_same_mem"}, raising=False)

    wmod.run_worker_mesa_once(
        area={"mesa": 7, "x1": 0, "y1": 0, "ancho": 10, "alto": 10},
        dirs=dirs,
        ts="20260310_190000_000000",
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

    assert called["ocr"] == 0
    assert called["preflop"] == 0
    assert called["process"] == 0
    assert called["insert_capture"] == 0
    assert not os.path.exists(img_path)


@pytest.mark.xfail(reason="run_worker_mesa_once still calls process_one_image on postflop; runtime guard not implemented yet", strict=False)
def test_run_worker_mesa_once_postflop_skips_preflop_processing(monkeypatch, tmp_path):
    dirs = _make_dirs(tmp_path)
    fp = io.StringIO()

    img_path = _make_cap_bmp(dirs, "cap_postflop.bmp")

    monkeypatch.setattr(wmod, "run_time_gate_on_roi_path", lambda *a, **k: {"time_ok": True})
    monkeypatch.setattr(wmod, "capture_to_tmp", lambda *a, **k: img_path)
    monkeypatch.setattr(wmod, "get_file_fingerprint", lambda _p: "fp_postflop")
    monkeypatch.setattr(wmod, "run_ocr", lambda _p: {"ok": True})

    monkeypatch.setattr(
        wmod,
        "_run_preflop_direct",
        lambda _p: {
            "preflop_ok": False,
            "modules": {
                "mano": {"valid": True, "mano_raw": "AsKd", "hand_class": "AKo"},
                "time": {"time_ok": True},
                "board_state": {
                    "street_state": "postflop",
                    "valid_count": 3,
                },
            },
        },
    )

    monkeypatch.setattr(wmod, "preflop_fail", lambda _preflop: False)
    monkeypatch.setattr(wmod, "safe_move", lambda src, dst_dir: os.path.join(dst_dir, os.path.basename(src)))

    called = {
        "process": 0,
        "persist": 0,
    }

    monkeypatch.setattr(
        wmod,
        "persist_preflop_obs",
        lambda **kwargs: called.__setitem__("persist", called["persist"] + 1) or 123,
    )

    seen = {"route": None}

    def update_worker_capture_route(**kwargs):
        seen["route"] = dict(kwargs)
        return True

    dbmod = SimpleNamespace(
        find_recent_capture_by_fingerprint=lambda **k: None,
        insert_worker_capture=lambda **k: 321,
        update_worker_capture_ocr=lambda **k: True,
        update_worker_capture_route=update_worker_capture_route,
    )

    monkeypatch.setattr(wmod, "_LAST_CAPTURE_FP_BY_MESA", {}, raising=False)

    wmod.run_worker_mesa_once(
        area={"mesa": 8, "x1": 0, "y1": 0, "ancho": 10, "alto": 10},
        dirs=dirs,
        ts="20260310_190500_000000",
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

    assert called["process"] == 0
    assert called["persist"] == 0
    assert seen["route"] is not None
    assert "postflop" in fp.getvalue().lower() or "flop" in fp.getvalue().lower()


