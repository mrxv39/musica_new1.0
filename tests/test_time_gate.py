import json
import os
import subprocess

from modules.preflop.workers_loop import time_gate as tg


def test_run_time_gate_for_area_ok_json(monkeypatch, tmp_path):
    roi_path = str(tmp_path / "roi.bmp")
    with open(roi_path, "wb") as f:
        f.write(b"roi")

    monkeypatch.setattr(tg, "build_time_bbox", lambda area: (1, 2, 3, 4))
    monkeypatch.setattr(tg, "capture_bbox_to_tmp", lambda bbox, tmp_dir, name: roi_path)

    completed = subprocess.CompletedProcess(
        args=["python"],
        returncode=0,
        stdout=json.dumps({"time_ok": True, "score": 0.91}),
        stderr="",
    )
    monkeypatch.setattr(subprocess, "run", lambda *a, **k: completed)

    out = tg.run_time_gate_for_area({"mesa": 1, "x1": 0, "y1": 0}, str(tmp_path), "ts1")

    assert out["time_ok"] is True
    assert out["score"] == 0.91
    assert "script_path" in out
    assert "image_path" in out
    assert not os.path.exists(roi_path)


def test_run_time_gate_for_area_timeout(monkeypatch, tmp_path):
    roi_path = str(tmp_path / "roi_timeout.bmp")
    with open(roi_path, "wb") as f:
        f.write(b"roi")

    monkeypatch.setattr(tg, "build_time_bbox", lambda area: (1, 2, 3, 4))
    monkeypatch.setattr(tg, "capture_bbox_to_tmp", lambda bbox, tmp_dir, name: roi_path)

    def raise_timeout(*args, **kwargs):
        raise subprocess.TimeoutExpired(cmd=["python"], timeout=5, output="partial", stderr="stderr_timeout")

    monkeypatch.setattr(subprocess, "run", raise_timeout)

    out = tg.run_time_gate_for_area({"mesa": 2, "x1": 0, "y1": 0}, str(tmp_path), "ts2")

    assert out["time_ok"] is False
    assert out["error"] == "time_timeout"
    assert out["timeout_sec"] == 5
    assert not os.path.exists(roi_path)


def test_run_time_gate_for_area_returncode_no_cero(monkeypatch, tmp_path):
    roi_path = str(tmp_path / "roi_fail.bmp")
    with open(roi_path, "wb") as f:
        f.write(b"roi")

    monkeypatch.setattr(tg, "build_time_bbox", lambda area: (1, 2, 3, 4))
    monkeypatch.setattr(tg, "capture_bbox_to_tmp", lambda bbox, tmp_dir, name: roi_path)

    completed = subprocess.CompletedProcess(
        args=["python"],
        returncode=9,
        stdout="bad",
        stderr="proc fail",
    )
    monkeypatch.setattr(subprocess, "run", lambda *a, **k: completed)

    out = tg.run_time_gate_for_area({"mesa": 3, "x1": 0, "y1": 0}, str(tmp_path), "ts3")

    assert out["time_ok"] is False
    assert out["error"] == "time_process_failed"
    assert out["returncode"] == 9
    assert not os.path.exists(roi_path)


def test_run_time_gate_for_area_stdout_vacio(monkeypatch, tmp_path):
    roi_path = str(tmp_path / "roi_empty.bmp")
    with open(roi_path, "wb") as f:
        f.write(b"roi")

    monkeypatch.setattr(tg, "build_time_bbox", lambda area: (1, 2, 3, 4))
    monkeypatch.setattr(tg, "capture_bbox_to_tmp", lambda bbox, tmp_dir, name: roi_path)

    completed = subprocess.CompletedProcess(
        args=["python"],
        returncode=0,
        stdout="",
        stderr="",
    )
    monkeypatch.setattr(subprocess, "run", lambda *a, **k: completed)

    out = tg.run_time_gate_for_area({"mesa": 4, "x1": 0, "y1": 0}, str(tmp_path), "ts4")

    assert out["time_ok"] is False
    assert out["error"] == "time_empty_stdout"
    assert not os.path.exists(roi_path)


def test_run_time_gate_for_area_json_invalido(monkeypatch, tmp_path):
    roi_path = str(tmp_path / "roi_bad_json.bmp")
    with open(roi_path, "wb") as f:
        f.write(b"roi")

    monkeypatch.setattr(tg, "build_time_bbox", lambda area: (1, 2, 3, 4))
    monkeypatch.setattr(tg, "capture_bbox_to_tmp", lambda bbox, tmp_dir, name: roi_path)

    completed = subprocess.CompletedProcess(
        args=["python"],
        returncode=0,
        stdout="{bad_json",
        stderr="",
    )
    monkeypatch.setattr(subprocess, "run", lambda *a, **k: completed)

    out = tg.run_time_gate_for_area({"mesa": 1, "x1": 0, "y1": 0}, str(tmp_path), "ts5")

    assert out["time_ok"] is False
    assert out["error"] == "time_invalid_json"
    assert not os.path.exists(roi_path)


def test_run_time_gate_for_area_json_no_dict(monkeypatch, tmp_path):
    roi_path = str(tmp_path / "roi_list_json.bmp")
    with open(roi_path, "wb") as f:
        f.write(b"roi")

    monkeypatch.setattr(tg, "build_time_bbox", lambda area: (1, 2, 3, 4))
    monkeypatch.setattr(tg, "capture_bbox_to_tmp", lambda bbox, tmp_dir, name: roi_path)

    completed = subprocess.CompletedProcess(
        args=["python"],
        returncode=0,
        stdout='["not", "dict"]',
        stderr="",
    )
    monkeypatch.setattr(subprocess, "run", lambda *a, **k: completed)

    out = tg.run_time_gate_for_area({"mesa": 1, "x1": 0, "y1": 0}, str(tmp_path), "ts6")

    assert out["time_ok"] is False
    assert out["error"] == "time_json_not_dict"
    assert not os.path.exists(roi_path)


def test_run_time_gate_for_area_spawn_exception(monkeypatch, tmp_path):
    roi_path = str(tmp_path / "roi_exc.bmp")
    with open(roi_path, "wb") as f:
        f.write(b"roi")

    monkeypatch.setattr(tg, "build_time_bbox", lambda area: (1, 2, 3, 4))
    monkeypatch.setattr(tg, "capture_bbox_to_tmp", lambda bbox, tmp_dir, name: roi_path)

    def raise_exc(*args, **kwargs):
        raise RuntimeError("spawn exploded")

    monkeypatch.setattr(subprocess, "run", raise_exc)

    out = tg.run_time_gate_for_area({"mesa": 1, "x1": 0, "y1": 0}, str(tmp_path), "ts7")

    assert out["time_ok"] is False
    assert out["error"] == "time_spawn_exception"
    assert "spawn exploded" in out["exception"]
    assert not os.path.exists(roi_path)
