# C:\Users\Usuario\Desktop\proyectos\musica_new\tests\test_worker.py
import unittest
import tempfile
import shutil
import os
import json
import subprocess
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

    def run_worker(self, image_path, max_ticks=2):
        cmd = [
            "python", WORKER_PATH,
            "--id", "1",
            "--interval_ms", "1",
            "--image", image_path,
            "--max_ticks", str(max_ticks),
        ]
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
        return (proc.stdout or "").strip(), proc.returncode

    def test_worker_replay(self):
        stdout, code = self.run_worker(self.img_path, max_ticks=2)
        lines = [l for l in stdout.split("\n") if l.strip()]
        self.assertEqual(code, 0)
        self.assertEqual(len(lines), 2)

        for i, line in enumerate(lines):
            data = json.loads(line)
            self.assertEqual(data["worker_id"], 1)
            self.assertEqual(data["mode"], "replay")
            self.assertEqual(data["tick"], i + 1)
            self.assertTrue(len(data["fingerprint"]) > 0)
            self.assertIn("preflop", data)
            self.assertIsInstance(data["preflop"], dict)
            self.assertIn("preflop_ok", data["preflop"])

    def test_worker_missing_image(self):
        stdout, code = self.run_worker(os.path.join(self.tmpdir, "nonexistent.png"), max_ticks=1)
        lines = [l for l in stdout.split("\n") if l.strip()]
        self.assertEqual(code, 0)
        self.assertEqual(len(lines), 1)

        data = json.loads(lines[0])
        self.assertIn("errors", data)
        self.assertTrue(data["errors"])
        self.assertIn("preflop", data)
        self.assertFalse(data["preflop"].get("preflop_ok", True))


if __name__ == "__main__":
    unittest.main()
