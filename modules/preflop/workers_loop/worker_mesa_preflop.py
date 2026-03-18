from __future__ import annotations

import json
import logging
import os
import subprocess
import sys
from typing import Any, Dict


def short_value(v: Any, max_len: int = 240) -> str:
    try:
        s = json.dumps(v, ensure_ascii=False, default=str)
    except Exception:
        logging.debug(f"json.dumps failed for value type={type(v).__name__}", exc_info=True)
        try:
            s = str(v)
        except Exception:
            logging.debug(f"str() failed for value type={type(v).__name__}", exc_info=True)
            s = "<unprintable>"
    s = s.replace("\r", " ").replace("\n", " ")
    if len(s) > max_len:
        s = s[: max_len - 3] + "..."
    return s


def describe_preflop_fail(preflop: Any) -> str:
    if preflop is None:
        return "preflop is None"

    if not isinstance(preflop, dict):
        return f"preflop is not dict: type={type(preflop).__name__} value={short_value(preflop)}"

    reasons = []

    preflop_ok = preflop.get("preflop_ok", None)
    if preflop_ok is not True:
        reasons.append(f"preflop_ok={preflop_ok!r}")

    for key in (
        "error",
        "reason",
        "message",
        "status",
        "debug",
        "hero",
        "hero_cards",
        "hand",
        "position",
        "positions",
        "situacion",
        "stackefectivo",
        "villano",
        "action",
    ):
        if key in preflop and preflop.get(key) not in (None, "", [], {}):
            reasons.append(f"{key}={short_value(preflop.get(key))}")

    if not reasons:
        reasons.append(f"payload={short_value(preflop)}")

    return " | ".join(reasons)


def write_preflop_fail_debug(dst_img_path: str, mesa: int, preflop: Any) -> None:
    dbg_path = dst_img_path + ".preflop_fail.json"
    payload = {
        "mesa": mesa,
        "reason_text": describe_preflop_fail(preflop),
        "preflop": preflop if isinstance(preflop, dict) else short_value(preflop, max_len=2000),
    }
    with open(dbg_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2, default=str)


def run_preflop_direct(img_path: str, timeout_sec: int = 30) -> Dict[str, Any]:
    script_path = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "preflop.py")
    )

    cmd = [
        sys.executable,
        script_path,
        "--image",
        img_path,
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
        return {
            "preflop_ok": False,
            "error": "preflop_timeout",
            "timeout_sec": timeout_sec,
            "script_path": script_path,
            "image_path": img_path,
            "stdout": (e.stdout or ""),
            "stderr": (e.stderr or ""),
        }
    except Exception as e:
        return {
            "preflop_ok": False,
            "error": "preflop_spawn_exception",
            "exception": str(e),
            "script_path": script_path,
            "image_path": img_path,
        }

    stdout = (proc.stdout or "").strip()
    stderr = (proc.stderr or "").strip()

    if proc.returncode != 0:
        return {
            "preflop_ok": False,
            "error": "preflop_process_failed",
            "returncode": proc.returncode,
            "stdout": stdout,
            "stderr": stderr,
            "script_path": script_path,
            "image_path": img_path,
        }

    if not stdout:
        return {
            "preflop_ok": False,
            "error": "preflop_empty_stdout",
            "stderr": stderr,
            "script_path": script_path,
            "image_path": img_path,
        }

    try:
        data = json.loads(stdout)
    except Exception as e:
        return {
            "preflop_ok": False,
            "error": "preflop_invalid_json",
            "exception": str(e),
            "stdout": stdout,
            "stderr": stderr,
            "script_path": script_path,
            "image_path": img_path,
        }

    if not isinstance(data, dict):
        return {
            "preflop_ok": False,
            "error": "preflop_json_not_dict",
            "payload": data,
            "stderr": stderr,
            "script_path": script_path,
            "image_path": img_path,
        }

    data.setdefault("preflop_ok", False)
    data.setdefault("script_path", script_path)
    data.setdefault("image_path", img_path)
    if stderr:
        data.setdefault("stderr", stderr)

    return data
