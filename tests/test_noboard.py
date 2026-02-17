# C:\Users\Usuario\Desktop\proyectos\musica_new\tests\test_noboard.py
import unittest
import tempfile
import shutil
import os
import json
import subprocess
from PIL import Image
import numpy as np

NOBOARD_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "../modules/preflop/noboard.py"))

ROI = (250, 230, 70, 70)
MEAN_MAX = 35.0
STD_MAX = 18.0
DARK_THR = 45
DARK_MIN_RATIO = 0.85


class TestNoboard(unittest.TestCase):
    def setUp(self):
        self.tmpdir = tempfile.mkdtemp()

        self.img_true = os.path.join(self.tmpdir, "synthetic_noboard_true.png")
        self.img_false = os.path.join(self.tmpdir, "synthetic_noboard_false.png")

        base = np.full((400, 400), 100, dtype=np.uint8)

        # Case 1: True -> ROI negra uniforme
        arr1 = base.copy()
        x, y, w, h = ROI
        arr1[y : y + h, x : x + w] = 0
        Image.fromarray(arr1).save(self.img_true)

        # Case 2: False -> ROI con patrón brillante/no uniforme (simula board)
        arr2 = base.copy()
        patch = np.zeros((h, w), dtype=np.uint8)
        patch[::2, ::2] = 60
        patch[1::2, 1::2] = 200
        arr2[y : y + h, x : x + w] = patch
        Image.fromarray(arr2).save(self.img_false)

    def tearDown(self):
        shutil.rmtree(self.tmpdir)

    def run_noboard(self, image_path: str) -> str:
        proc = subprocess.run(
            ["python", NOBOARD_PATH, "--image", image_path],
            capture_output=True,
            text=True,
            timeout=10,
        )
        return (proc.stdout or "").strip()

    def test_noboard_true(self):
        data = json.loads(self.run_noboard(self.img_true))

        self.assertIn("noboard_ok", data)
        self.assertIn("mean", data)
        self.assertIn("std", data)
        self.assertIn("dark_ratio", data)
        self.assertIn("fingerprint", data)

        self.assertIsInstance(data["noboard_ok"], bool)
        self.assertIsInstance(data["mean"], float)
        self.assertIsInstance(data["std"], float)
        self.assertIsInstance(data["dark_ratio"], float)
        self.assertIsInstance(data["fingerprint"], str)
        self.assertTrue(len(data["fingerprint"]) > 0)

        self.assertTrue(data["noboard_ok"])
        self.assertLessEqual(data["mean"], MEAN_MAX)
        self.assertLessEqual(data["std"], STD_MAX)
        self.assertGreaterEqual(data["dark_ratio"], DARK_MIN_RATIO)

    def test_noboard_false(self):
        data = json.loads(self.run_noboard(self.img_false))
        self.assertFalse(data["noboard_ok"])
        self.assertTrue(len(data["fingerprint"]) > 0)

    def test_missing_image(self):
        missing = os.path.join(self.tmpdir, "nonexistent.png")
        data = json.loads(self.run_noboard(missing))
        self.assertFalse(data["noboard_ok"])
        self.assertTrue(len(data["fingerprint"]) > 0)
        self.assertIn("error", data)


if __name__ == "__main__":
    unittest.main()
