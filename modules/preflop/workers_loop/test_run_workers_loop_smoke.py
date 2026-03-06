# C:\Users\Usuario\Desktop\proyectos\poker_boss\modules\preflop\workers_loop\test_run_workers_loop_smoke.py
from __future__ import annotations

import os
import sys
import tempfile
import unittest

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from modules.preflop.workers_loop import loop_runner


class TestRunWorkersLoopSmoke(unittest.TestCase):
    def test_smoke_start_tick_end_and_log(self):
        with tempfile.TemporaryDirectory() as td:
            base_dir = os.path.abspath(td)

            calls = {"ticks": 0}

            original_run_one_tick = loop_runner.run_one_tick
            original_sleep = loop_runner.time.sleep

            def fake_run_one_tick(**kwargs):
                calls["ticks"] += 1

            def stop_sleep(_):
                raise StopIteration("stop after 1 cycle")

            loop_runner.run_one_tick = fake_run_one_tick
            loop_runner.time.sleep = stop_sleep

            dirs = loop_runner.ensure_dirs(base_dir)

            try:
                with open(dirs.log_path, "a", encoding="utf-8") as fp:
                    try:
                        loop_runner.run_loop(
                            out_dir=base_dir,
                            interval_ms=200,
                            verbose=True,
                            fp=fp,
                        )
                    except StopIteration:
                        pass
            finally:
                loop_runner.run_one_tick = original_run_one_tick
                loop_runner.time.sleep = original_sleep

            self.assertEqual(calls["ticks"], 1)

            self.assertTrue(os.path.isdir(dirs.ok_dir))
            self.assertTrue(os.path.isdir(dirs.err_dir))
            self.assertTrue(os.path.isdir(dirs.del_dir))
            self.assertTrue(os.path.exists(dirs.log_path), "log file not created")

            with open(dirs.log_path, "r", encoding="utf-8") as f:
                log_txt = f.read()

            self.assertIn("START run_workers_loop", log_txt)
            self.assertIn("TICK_START n=1", log_txt)
            self.assertIn("TICK_END n=1", log_txt)
            self.assertIn("POKER_BOSS_FALLBACK_SE", log_txt)


if __name__ == "__main__":
    unittest.main(verbosity=2)
