# C:\Users\Usuario\Desktop\proyectos\poker_boss\modules\workers\worker_preflop.py
import os
import sys
import json
import subprocess
from typing import Dict


_PREPLOF_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "../preflop/preflop.py"))


def run_preflop_subprocess(image_path: str) -> Dict:
    try:
        proc = subprocess.run(
            [sys.executable, _PREPLOF_PATH, "--image", image_path],
            capture_output=True,
            text=True,
            timeout=10,
        )
        if proc.returncode != 0 or not (proc.stdout or "").strip():
            return {"error": "preflop failed", "preflop_ok": False}

        try:
            data = json.loads(proc.stdout)
            if isinstance(data, dict):
                return data
            return {"error": "preflop invalid json (not object)", "preflop_ok": False}
        except Exception:
            return {"error": "preflop invalid json", "preflop_ok": False}
    except Exception as e:
        return {"error": str(e), "preflop_ok": False}


def run_preflop(image_path: str) -> Dict:
    """
    Default: subprocess (same as before).
    Optional speed mode (opt-in):
      set env PREFLOP_INPROCESS=1 to attempt in-process execution.
    If in-process fails, falls back to subprocess.
    """
    use_inprocess = (os.environ.get("PREFLOP_INPROCESS", "") or "").strip() in ("1", "true", "TRUE", "yes", "YES")
    if not use_inprocess:
        return run_preflop_subprocess(image_path)

    # Opt-in path: attempt to import and call a function if present.
    # No assumptions: safest is to try known patterns and fallback.
    try:
        # If preflop module exposes a function, use it (fast).
        # This is optional and may not exist; fallback is safe.
        from modules.preflop import preflop as preflop_mod  # type: ignore

        if hasattr(preflop_mod, "run_preflop") and callable(getattr(preflop_mod, "run_preflop")):
            return preflop_mod.run_preflop(image_path)  # type: ignore

        if hasattr(preflop_mod, "main") and callable(getattr(preflop_mod, "main")):
            # If main returns dict when called with args; otherwise fallback
            try:
                return preflop_mod.main(["--image", image_path])  # type: ignore
            except Exception:
                pass

    except Exception:
        pass

    return run_preflop_subprocess(image_path)
