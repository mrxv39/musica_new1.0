
# [test_id:BASE_OCR_Modular]
import os
import sys
import json
import tempfile
import unittest
import subprocess
from pathlib import Path

from PIL import Image


PROJECT_ROOT = Path(__file__).resolve().parents[1]
MANO_PY = PROJECT_ROOT / "modules" / "preflop" / "mano.py"

REGION_CARTA1 = (339, 408, 35, 35)
REGION_CARTA2 = (389, 408, 35, 35)


def _make_pattern_image(dot_xy, size=(35, 35)):
    """
    Imagen gris NO-constante (evita degeneración de TM_CCOEFF_NORMED).
    Fondo 0 + un píxel blanco en dot_xy.
    """
    img = Image.new("L", size, color=0)
    px = img.load()
    x, y = dot_xy
    px[x, y] = 255
    return img


def _write_template(path: Path, dot_xy):
    img = _make_pattern_image(dot_xy)
    img.save(path)


def _make_templates(tmp_root: Path):
    """
    Templates deterministas:
    - 9c: dot en (5,5)
    - 9d: dot en (5,6)
    """
    (tmp_root / "cartasc").mkdir(parents=True, exist_ok=True)
    (tmp_root / "cartasd").mkdir(parents=True, exist_ok=True)

    _write_template(tmp_root / "cartasc" / "9.png", (5, 5))
    _write_template(tmp_root / "cartasd" / "9.png", (5, 6))


def _make_screenshot(img_path: Path):
    """
    Pegamos EXACTAMENTE los templates en las regiones:
    - carta1 = patrón 9c
    - carta2 = patrón 9d
    """
    w, h = 900, 900
    base = Image.new("L", (w, h), color=0)

    tpl_c = _make_pattern_image((5, 5))
    tpl_d = _make_pattern_image((5, 6))

    x1, y1, _, _ = REGION_CARTA1
    x2, y2, _, _ = REGION_CARTA2

    base.paste(tpl_c, (x1, y1))
    base.paste(tpl_d, (x2, y2))

    base.save(img_path)


def _run_mano(image_path: str, template_root: str | None):
    env = os.environ.copy()
    if template_root is not None:
        env["MANO_TEMPLATE_ROOT"] = template_root

    proc = subprocess.run(
        [sys.executable, str(MANO_PY), "--image", image_path],
        cwd=str(PROJECT_ROOT),
        capture_output=True,
        text=True,
        env=env,
        timeout=10,
    )
    return proc.returncode, proc.stdout.strip(), proc.stderr.strip()


class TestMano(unittest.TestCase):
    def test_valid_hand(self):
        with tempfile.TemporaryDirectory() as td:
            td_path = Path(td)

            templates_root = td_path / "ranks"
            templates_root.mkdir(parents=True, exist_ok=True)
            _make_templates(templates_root)

            img_path = td_path / "shot.png"
            _make_screenshot(img_path)

            code, stdout, stderr = _run_mano(str(img_path), str(templates_root))

            self.assertTrue(stdout, f"mano.py returned empty stdout. stderr={stderr!r}")
            data = json.loads(stdout)

            for k in ["valid", "card1", "card2", "score1", "score2", "fingerprint", "mano_raw", "hand_rank", "hand_class", "suited"]:
                self.assertIn(k, data)

            self.assertIsInstance(data["valid"], bool)
            self.assertIsInstance(data["suited"], bool)
            self.assertIsInstance(data["score1"], float)
            self.assertIsInstance(data["score2"], float)
            self.assertIsInstance(data["fingerprint"], str)
            self.assertTrue(data["fingerprint"])

            self.assertTrue(data["valid"], f"Expected valid hand. got={data}")
            self.assertEqual(data["mano_raw"], "9c9d")
            self.assertEqual(data["hand_rank"], "99")
            self.assertEqual(data["hand_class"], "99")
            self.assertFalse(data["suited"])

    def test_invalid_image(self):
        code, stdout, stderr = _run_mano("Z:\\this_file_does_not_exist.png", None)

        self.assertTrue(stdout, f"mano.py returned empty stdout. stderr={stderr!r}")
        data = json.loads(stdout)

        self.assertIn("valid", data)
        self.assertIn("fingerprint", data)
        self.assertFalse(data["valid"])
        self.assertIsInstance(data["fingerprint"], str)
        self.assertTrue(data["fingerprint"], "fingerprint must not be empty on error")


if __name__ == "__main__":
    unittest.main()
