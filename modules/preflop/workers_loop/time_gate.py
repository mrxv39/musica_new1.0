# C:\Users\Usuario\Desktop\proyectos\poker_boss\modules\preflop\workers_loop\time_gate.py
from __future__ import annotations

import json
import os
import subprocess
import sys
from typing import Any, Dict

from .capture import capture_bbox_to_tmp
from .mesa_config import build_time_bbox


def run_time_gate_for_area(area: Dict[str, Any], tmp_dir: str, ts: str, timeout_sec: int = 5) -> Dict[str, Any]:
    mesa = int(area["mesa"])
    bbox = build_time_bbox(area)
    roi_path = capture_bbox_to_tmp(
        bbox,
        tmp_dir,
        f"{ts}__mesa_{mesa}__time_roi.bmp",
    )

    script_path = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "time.py")
    )

    cmd = [
        sys.executable,
        script_path,
        "--image",
        roi_path,
    ]

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
        out = {
            "time_ok": False,
            "error": "time_timeout",
            "timeout_sec": timeout_sec,
            "script_path": script_path,
            "image_path": roi_path,
            "stdout": (e.stdout or ""),
            "stderr": (e.stderr or ""),
        }
    except Exception as e:
        out = {
            "time_ok": False,
            "error": "time_spawn_exception",
            "exception": str(e),
            "script_path": script_path,
            "image_path": roi_path,
        }
    else:
        stdout = (proc.stdout or "").strip()
        stderr = (proc.stderr or "").strip()

        if proc.returncode != 0:
            out = {
                "time_ok": False,
                "error": "time_process_failed",
                "returncode": proc.returncode,
                "stdout": stdout,
                "stderr": stderr,
                "script_path": script_path,
                "image_path": roi_path,
            }
        elif not stdout:
            out = {
                "time_ok": False,
                "error": "time_empty_stdout",
                "stderr": stderr,
                "script_path": script_path,
                "image_path": roi_path,
            }
        else:
            try:
                data = json.loads(stdout)
                if not isinstance(data, dict):
                    out = {
                        "time_ok": False,
                        "error": "time_json_not_dict",
                        "payload": data,
                        "stderr": stderr,
                        "script_path": script_path,
                        "image_path": roi_path,
                    }
                else:
                    data.setdefault("time_ok", False)
                    data.setdefault("script_path", script_path)
                    data.setdefault("image_path", roi_path)
                    if stderr:
                        data.setdefault("stderr", stderr)
                    out = data
            except Exception as e:
                out = {
                    "time_ok": False,
                    "error": "time_invalid_json",
                    "exception": str(e),
                    "stdout": stdout,
                    "stderr": stderr,
                    "script_path": script_path,
                    "image_path": roi_path,
                }

    try:
        if os.path.exists(roi_path):
            os.remove(roi_path)
    except Exception:
        pass

    return out
