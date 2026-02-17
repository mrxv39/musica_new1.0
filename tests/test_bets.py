# C:\Users\Usuario\Desktop\proyectos\musica_new\tests\test_bets.py

import os
import unittest
from unittest.mock import patch

import numpy as np

from modules.ocr import bets


class TestBetsOCR(unittest.TestCase):
    def setUp(self):
        # crear archivo dummy para que os.path.exists sea True
        self.tmp_path = os.path.abspath("tmp_test_bets.png")
        with open(self.tmp_path, "wb") as f:
            f.write(b"\x89PNG\r\n\x1a\n")

    def tearDown(self):
        try:
            os.remove(self.tmp_path)
        except Exception:
            pass

    @patch("modules.ocr.bets.pytesseract.image_to_string")
    @patch("modules.ocr.bets.cv2.imread")
    def test_ok_path_at_least_one_roi_ok(self, m_imread, m_ocr):
        # Imagen lo bastante grande para los ROIs
        img = np.zeros((600, 800), dtype=np.uint8)
        m_imread.return_value = img

        # Simular OCR:
        # - primera variante devuelve algo parseable
        # Como se llama múltiples veces (3 rois x N variantes), devolvemos siempre lo mismo.
        m_ocr.return_value = "123.45\n"

        res = bets.read_bets(self.tmp_path)
        self.assertTrue(res["ok"])
        self.assertAlmostEqual(res["p1"], 123.45, places=2)
        self.assertAlmostEqual(res["p2"], 123.45, places=2)
        self.assertAlmostEqual(res["p3"], 123.45, places=2)
        self.assertEqual(res["raw"]["p1"], "123.45")

    @patch("modules.ocr.bets.cv2.imread")
    def test_roi_out_of_bounds_ok_false_if_none_ok(self, m_imread):
        # Imagen demasiado pequeña -> todos los ROIs fallan out of bounds
        img = np.zeros((50, 50), dtype=np.uint8)
        m_imread.return_value = img

        res = bets.read_bets(self.tmp_path)
        self.assertFalse(res["ok"])
        self.assertIn("p1:roi_out_of_bounds", res["errors"])
        self.assertIn("p2:roi_out_of_bounds", res["errors"])
        self.assertIn("p3:roi_out_of_bounds", res["errors"])

    def test_missing_image(self):
        res = bets.read_bets("C:\\no_existe_bets.png")
        self.assertFalse(res["ok"])
        self.assertIn("image_not_found", res["errors"])


if __name__ == "__main__":
    unittest.main()
