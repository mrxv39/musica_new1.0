
# [test_id:BASE_WorkerReplayDir]
import unittest
import tempfile
import shutil
import os
import json
import sys
import io
from contextlib import redirect_stdout, redirect_stderr
from unittest.mock import patch
from PIL import Image
import numpy as np

WORKER_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "../modules/workers/worker.py"))


class TestWorker(unittest.TestCase):
    def setUp(self):
        self.tmpdir = tempfile.mkdtemp()
        self.img_path = os.path.join(self.tmpdir, "synthetic_worker.png")
        img = Image.fromarray(np.full((400, 400), 100, dtype=np.uint8))
        img.save(self.img_path)

    def tearDown(self):
        shutil.rmtree(self.tmpdir)

    def format_worker_debug(self, stdout, stderr, returncode=None):
        parts = []
        if returncode is not None:
            parts.append(f"returncode={returncode}")
        parts.append(f"stdout:\n{(stdout or '').strip() or '<empty>'}")
        parts.append(f"stderr:\n{(stderr or '').strip() or '<empty>'}")
        return "\n".join(parts)

    def run_worker(self, image_path, max_ticks=2):
        from modules.workers import worker

        argv = [
            WORKER_PATH,
            "--id", "1",
            "--interval_ms", "1",
            "--image", image_path,
            "--max_ticks", str(max_ticks),
        ]
        stdout_buffer = io.StringIO()
        stderr_buffer = io.StringIO()

        def fake_run_preflop(_image_path):
            return {
                "preflop_ok": True,
                "modules": {
                    "mano": {
                        "mano_ok": True,
                        "valid": True,
                        "mano_raw": "AsKd",
                        "hand_class": "AKo",
                    },
                    "noboard": {"noboard_ok": True},
                    "stacks": {"p1": 20.0},
                },
            }

        def fake_run_ocr(_image_path):
            return {
                "ok": True,
                "errors": [],
                "names": {},
                "villano": {},
                "stackefectivo": {"ok": True, "value": 20.0},
                "bets": {"ok": True, "p2": 0.5, "p3": 1.0},
                "stacks": {"ok": True, "p1": 20.0},
                "table_state": {},
                "dealer": {},
                "posiciones": {},
                "gamecode": {},
            }

        def fake_compute_strategy(**_kwargs):
            return {"ok": False, "reason": "test_stub_strategy"}

        with patch.object(sys, "argv", argv):
            with patch("modules.workers.worker_loop.run_preflop", side_effect=fake_run_preflop):
                with patch("modules.ocr.ocr.run_ocr", side_effect=fake_run_ocr):
                    with patch("modules.workers.worker_loop.compute_strategy", side_effect=fake_compute_strategy):
                        with patch("modules.workers.worker_loop.persist_obs", lambda *args, **kwargs: None):
                            with redirect_stdout(stdout_buffer), redirect_stderr(stderr_buffer):
                                try:
                                    worker.main()
                                    returncode = 0
                                except SystemExit as exc:
                                    returncode = exc.code if isinstance(exc.code, int) else 1

        return stdout_buffer.getvalue().strip(), stderr_buffer.getvalue().strip(), returncode

    def test_worker_replay(self):
        stdout, stderr, code = self.run_worker(self.img_path, max_ticks=2)
        lines = [l for l in stdout.splitlines() if l.strip()]
        debug = self.format_worker_debug(stdout, stderr, code)
        try:
            self.assertEqual(code, 0, debug)
            self.assertEqual(len(lines), 2, debug)

            for i, line in enumerate(lines):
                data = json.loads(line)
                self.assertEqual(data["worker_id"], 1, debug)
                self.assertEqual(data["mode"], "replay", debug)
                self.assertEqual(data["tick"], i + 1, debug)
                self.assertTrue(len(data["fingerprint"]) > 0, debug)
                self.assertIn("preflop", data, debug)
                self.assertIsInstance(data["preflop"], dict, debug)
                self.assertIn("preflop_ok", data["preflop"], debug)
        except Exception:
            print(debug)
            raise

    def test_worker_missing_image(self):
        stdout, stderr, code = self.run_worker(os.path.join(self.tmpdir, "nonexistent.png"), max_ticks=1)
        lines = [l for l in stdout.splitlines() if l.strip()]
        debug = self.format_worker_debug(stdout, stderr, code)
        try:
            self.assertEqual(code, 0, debug)
            self.assertEqual(len(lines), 1, debug)

            data = json.loads(lines[0])
            self.assertIn("errors", data, debug)
            self.assertTrue(data["errors"], debug)
            self.assertIn("preflop", data, debug)
            self.assertFalse(data["preflop"].get("preflop_ok", True), debug)
        except Exception:
            print(debug)
            raise


if __name__ == "__main__":
    unittest.main()
