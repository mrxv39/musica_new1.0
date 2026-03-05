# C:\Users\Usuario\Desktop\proyectos\poker_boss\modules\preflop\workers_loop\test_run_workers_loop_integration.py
from __future__ import annotations

import os
import sys
import glob
import time
import shutil
import tempfile
import subprocess
import unittest

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

# We patch capture_to_tmp to avoid real screen capture, but DO NOT patch OCR/strategy/preflop.
from modules.preflop.workers_loop import loop_runner


def _pick_any_test_image() -> str:
    base = os.path.join(PROJECT_ROOT, "modules", "preflop", "test_images")
    candidates = []
    for sub in ["ok", "errors", "borrar", "_tmp"]:
        candidates += glob.glob(os.path.join(base, sub, "*.bmp"))
    # also allow direct in test_images root
    candidates += glob.glob(os.path.join(base, "*.bmp"))
    if not candidates:
        raise RuntimeError(f"No .bmp found under {base}. Put at least one bmp in test_images/(ok|errors|borrar).")
    # pick newest
    candidates.sort(key=lambda p: os.path.getmtime(p), reverse=True)
    return candidates[0]


class TestRunWorkersLoopIntegration(unittest.TestCase):
    def test_entrypoint_runs_and_routes_one_image(self):
        img_src = _pick_any_test_image()

        with tempfile.TemporaryDirectory() as td:
            out_dir = os.path.abspath(td)

            # Copy source image into temp so we don't touch your real dataset
            fixed_img = os.path.join(out_dir, "fixed_input.bmp")
            shutil.copy2(img_src, fixed_img)

            # Patch AREAS to single mesa
            loop_runner.AREAS = [{"mesa": 1, "x1": 0, "y1": 0, "x2": 10, "y2": 10}]

            # Patch capture only: always "capture" the fixed image by copying it into _tmp with expected name
            def fake_capture_to_tmp(area, tmp_dir, ts):
                p = os.path.join(tmp_dir, f"{ts}__mesa_1.bmp")
                shutil.copy2(fixed_img, p)
                return p

            loop_runner.capture_to_tmp = fake_capture_to_tmp

            # Run the REAL entrypoint as subprocess (same as Tauri)
            entry = os.path.join(PROJECT_ROOT, "modules", "preflop", "run_workers_loop.py")

            p = subprocess.Popen(
                [sys.executable, entry, "--out_dir", out_dir, "--interval_ms", "200", "--verbose"],
                cwd=PROJECT_ROOT,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
            )

            # Let it run a bit, then stop (it is an infinite loop)
            time.sleep(2.0)
            p.terminate()
            try:
                p.wait(timeout=3.0)
            except subprocess.TimeoutExpired:
                p.kill()
                p.wait(timeout=3.0)

            stdout = (p.stdout.read() if p.stdout else "") if p.stdout else ""
            stderr = (p.stderr.read() if p.stderr else "") if p.stderr else ""
            combined = (stdout + "\n" + stderr).strip()

            # The script should not fail on import (your previous error)
            self.assertNotIn("ModuleNotFoundError: No module named 'modules'", combined)

            # It should have created routing folders
            ok_dir = os.path.join(out_dir, "ok")
            err_dir = os.path.join(out_dir, "errors")
            del_dir = os.path.join(out_dir, "borrar")
            self.assertTrue(os.path.isdir(ok_dir))
            self.assertTrue(os.path.isdir(err_dir))
            self.assertTrue(os.path.isdir(del_dir))

            # One bmp should have been routed somewhere (ok/errors/borrar)
            ok_files = glob.glob(os.path.join(ok_dir, "*.bmp"))
            err_files = glob.glob(os.path.join(err_dir, "*.bmp"))
            del_files = glob.glob(os.path.join(del_dir, "*.bmp"))
            total = len(ok_files) + len(err_files) + len(del_files)

            self.assertGreaterEqual(total, 1, f"No routed bmp found. stdout/stderr:\n{combined}")

            # Log exists and has START
            log_path = os.path.join(out_dir, "_logs", "run_workers_loop.log")
            self.assertTrue(os.path.exists(log_path), "log file not created")
            with open(log_path, "r", encoding="utf-8") as f:
                log_txt = f.read()
            self.assertIn("START run_workers_loop", log_txt)


if __name__ == "__main__":
    unittest.main(verbosity=2)
