# C:\Users\Usuario\Desktop\proyectos\poker_boss\modules\workers\worker_preflop.py
from __future__ import annotations

import json
import os
import subprocess
import sys
from typing import Any, Dict


DEFAULT_PREFLOP_TIMEOUT_SEC = int(os.environ.get("POKER_BOSS_PREFLOP_TIMEOUT_SEC", "12"))


def run_preflop_subprocess(image_path: str, timeout_sec: int = DEFAULT_PREFLOP_TIMEOUT_SEC) -> Dict[str, Any]:
    script_path = os.path.join("modules", "preflop", "run_preflop.py")

    cmd = [
        sys.executable,
        script_path,
        "--image",
        image_path,
    ]

    try:
        proc = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            cwd=os.getcwd(),
            timeout=timeout_sec,
        )
    except subprocess.TimeoutExpired:
        return {
            "preflop_ok": False,
            "error": f"run_preflop_timeout:{timeout_sec}s",
            "image_path": image_path,
        }
    except Exception as e:
        return {
            "preflop_ok": False,
            "error": f"run_preflop_subprocess_exception:{type(e).__name__}:{e}",
            "image_path": image_path,
        }

    stdout = (proc.stdout or "").strip()
    stderr = (proc.stderr or "").strip()

    if proc.returncode != 0:
        return {
            "preflop_ok": False,
            "error": f"run_preflop_rc:{proc.returncode}",
            "stderr": stderr,
            "stdout": stdout,
            "image_path": image_path,
        }

    if not stdout:
        return {
            "preflop_ok": False,
            "error": "run_preflop_empty_stdout",
            "stderr": stderr,
            "image_path": image_path,
        }

    try:
        data = json.loads(stdout)
        if not isinstance(data, dict):
            return {
                "preflop_ok": False,
                "error": "run_preflop_invalid_json_type",
                "stdout": stdout,
                "stderr": stderr,
                "image_path": image_path,
            }
        return data
    except Exception as e:
        return {
            "preflop_ok": False,
            "error": f"run_preflop_bad_json:{type(e).__name__}:{e}",
            "stdout": stdout,
            "stderr": stderr,
            "image_path": image_path,
        }


def run_preflop(image_path: str) -> Dict[str, Any]:
    return run_preflop_subprocess(image_path)
