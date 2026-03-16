from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
from typing import Any, Dict

from .capture import capture_bbox_to_tmp
from .mesa_config import build_time_bbox


DEBUG_SAVE_SCORE_MIN = float(os.environ.get("POKER_BOSS_TIME_GATE_DEBUG_SCORE_MIN", "0.70"))
_DEBUG_SAVED_MESAS: set[int] = set()


def _safe_name(value: Any) -> str:
    text = str(value)
    return "".join(ch if ch.isalnum() or ch in ("-", "_", ".") else "_" for ch in text)


def _write_area_and_roi_probe_once(
    *,
    area: Dict[str, Any],
    tmp_dir: str,
    ts: str,
    roi_path: str,
) -> None:
    try:
        mesa = int(area["mesa"])
        if mesa in _DEBUG_SAVED_MESAS:
            return

        base_dir = os.path.dirname(tmp_dir)
        probe_dir = os.path.join(base_dir, "time_gate_probe")
        os.makedirs(probe_dir, exist_ok=True)

        base_name = f"{_safe_name(ts)}__mesa_{mesa}"

        area_bbox = (
            int(area["x1"]),
            int(area["y1"]),
            int(area["x2"]),
            int(area["y2"]),
        )

        area_dst = os.path.join(probe_dir, base_name + "__AREA.bmp")
        time_dst = os.path.join(probe_dir, base_name + "__TIME.bmp")

        capture_bbox_to_tmp(
            area_bbox,
            probe_dir,
            os.path.basename(area_dst),
        )

        shutil.copy2(roi_path, time_dst)

        payload = {
            "mesa": mesa,
            "ts": ts,
            "area": {
                "mesa": area.get("mesa"),
                "x1": area.get("x1"),
                "y1": area.get("y1"),
                "x2": area.get("x2"),
                "y2": area.get("y2"),
            },
            "area_probe_path": os.path.abspath(area_dst),
            "time_probe_path": os.path.abspath(time_dst),
            "roi_source_path": os.path.abspath(roi_path),
        }

        with open(os.path.join(probe_dir, base_name + "__probe.json"), "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, indent=2, default=str)

        _DEBUG_SAVED_MESAS.add(mesa)
    except Exception:
        pass


def _maybe_write_time_gate_debug(
    *,
    area: Dict[str, Any],
    tmp_dir: str,
    ts: str,
    roi_path: str,
    bbox: Any,
    out: Dict[str, Any],
) -> None:
    try:
        score = out.get("score", None)
        time_ok = bool(out.get("time_ok"))

        score_num = None
        try:
            if score is not None:
                score_num = float(score)
        except Exception:
            pass

        should_save = (not time_ok) or (score_num is not None and score_num >= DEBUG_SAVE_SCORE_MIN)
        if not should_save:
            return

        mesa = int(area["mesa"])

        base_dir = os.path.dirname(tmp_dir)
        debug_dir = os.path.join(base_dir, "time_gate_debug")
        os.makedirs(debug_dir, exist_ok=True)

        score_tag = "na" if score_num is None else f"{score_num:.4f}".replace(".", "_")
        status_tag = "ok" if time_ok else "false"

        base_name = f"{_safe_name(ts)}__mesa_{mesa}__time_gate__{status_tag}__score_{score_tag}"

        dst_img = os.path.join(debug_dir, base_name + ".bmp")
        shutil.copy2(roi_path, dst_img)

        payload = {
            "mesa": mesa,
            "ts": ts,
            "bbox": list(bbox) if isinstance(bbox, (tuple, list)) else bbox,
            "time_ok": time_ok,
            "score": score_num,
            "threshold_debug_min": DEBUG_SAVE_SCORE_MIN,
            "area": {
                "mesa": area.get("mesa"),
                "x1": area.get("x1"),
                "y1": area.get("y1"),
                "x2": area.get("x2"),
                "y2": area.get("y2"),
            },
            "roi_path_original": os.path.abspath(roi_path),
            "roi_path_debug": os.path.abspath(dst_img),
            "out": out,
        }

        with open(dst_img + ".json", "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, indent=2, default=str)

    except Exception:
        pass


def _run_time_script_on_roi(roi_path: str, timeout_sec: int) -> Dict[str, Any]:
    """Run time.py on an existing ROI image; returns parsed out dict."""
    script_path = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "time.py")
    )
    cmd = [sys.executable, script_path, "--image", roi_path]
    try:
        proc = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout_sec,
            encoding="utf-8",
            errors="replace",
        )
    except subprocess.TimeoutExpired as e:
        return {
            "time_ok": False,
            "error": "time_timeout",
            "timeout_sec": timeout_sec,
            "script_path": script_path,
            "image_path": roi_path,
            "stdout": (e.stdout or ""),
            "stderr": (e.stderr or ""),
        }
    except Exception as e:
        return {
            "time_ok": False,
            "error": "time_spawn_exception",
            "exception": str(e),
            "script_path": script_path,
            "image_path": roi_path,
        }

    stdout = (proc.stdout or "").strip()
    stderr = (proc.stderr or "").strip()
    if proc.returncode != 0:
        return {
            "time_ok": False,
            "error": "time_process_failed",
            "returncode": proc.returncode,
            "stdout": stdout,
            "stderr": stderr,
            "script_path": script_path,
            "image_path": roi_path,
        }
    if not stdout:
        return {
            "time_ok": False,
            "error": "time_empty_stdout",
            "stderr": stderr,
            "script_path": script_path,
            "image_path": roi_path,
        }
    try:
        data = json.loads(stdout)
        if not isinstance(data, dict):
            return {
                "time_ok": False,
                "error": "time_json_not_dict",
                "payload": data,
                "stderr": stderr,
                "script_path": script_path,
                "image_path": roi_path,
            }
        data.setdefault("time_ok", False)
        data.setdefault("script_path", script_path)
        data.setdefault("image_path", roi_path)
        if stderr:
            data.setdefault("stderr", stderr)
        return data
    except Exception as e:
        return {
            "time_ok": False,
            "error": "time_invalid_json",
            "exception": str(e),
            "stdout": stdout,
            "stderr": stderr,
            "script_path": script_path,
            "image_path": roi_path,
        }


def run_time_gate_on_roi_path(
    area: Dict[str, Any], tmp_dir: str, ts: str, roi_path: str, timeout_sec: int = 5
) -> Dict[str, Any]:
    """Run time gate using an existing ROI image path (e.g. cropped from full-area capture)."""
    bbox = build_time_bbox(area)
    _write_area_and_roi_probe_once(area=area, tmp_dir=tmp_dir, ts=ts, roi_path=roi_path)
    out = _run_time_script_on_roi(roi_path, timeout_sec)
    _maybe_write_time_gate_debug(
        area=area, tmp_dir=tmp_dir, ts=ts, roi_path=roi_path, bbox=bbox, out=out
    )
    try:
        if os.path.exists(roi_path):
            os.remove(roi_path)
    except Exception:
        pass
    return out


def run_time_gate_for_area(area: Dict[str, Any], tmp_dir: str, ts: str, timeout_sec: int = 5) -> Dict[str, Any]:
    mesa = int(area["mesa"])
    bbox = build_time_bbox(area)
    roi_path = capture_bbox_to_tmp(
        bbox,
        tmp_dir,
        f"{ts}__mesa_{mesa}__time_roi.bmp",
    )
    return run_time_gate_on_roi_path(area, tmp_dir, ts, roi_path, timeout_sec)
