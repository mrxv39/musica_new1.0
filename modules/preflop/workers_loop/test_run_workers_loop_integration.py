# C:\Users\Usuario\Desktop\proyectos\poker_boss\modules\preflop\workers_loop\test_run_workers_loop_integration.py
from __future__ import annotations

import os
import sys
import tempfile
import subprocess
import time
import unittest

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)


class TestRunWorkersLoopIntegration(unittest.TestCase):
    def test_entrypoint_runs_creates_dirs_and_writes_stdout_log(self):
        with tempfile.TemporaryDirectory() as td:
            out_dir = os.path.abspath(td)
            entry = os.path.join(PROJECT_ROOT, "modules", "preflop", "run_workers_loop.py")

            env = os.environ.copy()
            env["PYTHONPATH"] = PROJECT_ROOT + os.pathsep + env.get("PYTHONPATH", "")

            p = subprocess.Popen(
                [
                    sys.executable,
                    entry,
                    "--out_dir",
                    out_dir,
                    "--interval_ms",
                    "200",
                    "--max_ticks",
                    "1",
                    "--verbose",
                ],
                cwd=PROJECT_ROOT,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                env=env,
            )

            try:
                p.wait(timeout=10.0)
            except subprocess.TimeoutExpired:
                p.kill()
                p.wait(timeout=5.0)

            stdout = p.stdout.read() if p.stdout else ""
            stderr = p.stderr.read() if p.stderr else ""
            combined = (stdout + "\n" + stderr).strip()

            self.assertNotIn("ModuleNotFoundError: No module named 'modules'", combined)

            ok_dir = os.path.join(out_dir, "ok")
            err_dir = os.path.join(out_dir, "no ok")
            del_dir = os.path.join(out_dir, "no ok")
            tmp_dir = os.path.join(out_dir, "_tmp")
            log_dir = os.path.join(out_dir, "_logs")

            for _ in range(20):
                if all(os.path.isdir(p) for p in [ok_dir, err_dir, tmp_dir, log_dir]):
                    break
                time.sleep(0.2)
            self.assertTrue(os.path.isdir(ok_dir), f"ok dir not created | combined={combined!r}")
            self.assertTrue(os.path.isdir(err_dir), f"no ok dir not created | combined={combined!r}")
            self.assertTrue(os.path.isdir(del_dir), f"no ok dir not created | combined={combined!r}")
            self.assertTrue(os.path.isdir(tmp_dir), f"_tmp dir not created | combined={combined!r}")
            self.assertTrue(os.path.isdir(log_dir), f"_logs dir not created | combined={combined!r}")

            self.assertIn("START run_workers_loop", combined)
            self.assertIn("PROJECT_ROOT=", combined)
            self.assertIn("POKER_BOSS_FALLBACK_SE=", combined)
            self.assertIn("TICK_START", combined)


if __name__ == "__main__":
    unittest.main(verbosity=2)


