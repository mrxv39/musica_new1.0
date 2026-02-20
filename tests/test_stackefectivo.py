
# [test_id:BASE_OCR_Modular]

import os
import unittest
from unittest.mock import patch

import numpy as np

from modules.ocr.stackefectivo import read_stack_efectivo


class TestStackEfectivo(unittest.TestCase):
    def setUp(self):
        # Crear un "archivo" dummy en disco para que os.path.exists() sea True
        self.tmp_path = os.path.abspath("tmp_test_stack.png")
        with open(self.tmp_path, "wb") as f:
            f.write(b"\x89PNG\r\n\x1a\n")  # header dummy

    def tearDown(self):
        try:
            os.remove(self.tmp_path)
        except Exception:
            pass

    @patch("modules.ocr.stackefectivo.pytesseract.image_to_string")
    @patch("modules.ocr.stackefectivo.cv2.imread")
    def test_ok_parses_value(self, m_imread, m_ocr):
        # Imagen grande suficiente para ROI default (x=265,y=472,w=72,h=42)
        img = np.zeros((600, 600, 3), dtype=np.uint8)
        m_imread.return_value = img

        # Primera llamada devuelve un texto parseable
        m_ocr.return_value = "12.5\n"

        res = read_stack_efectivo(self.tmp_path)
        self.assertTrue(res["ok"])
        self.assertAlmostEqual(res["value"], 12.5, places=3)
        self.assertIn("roi", res)
        self.assertIn("method", res)

    @patch("modules.ocr.stackefectivo.cv2.imread")
    def test_roi_out_of_bounds(self, m_imread):
        # Imagen pequeña: ROI queda fuera
        img = np.zeros((100, 100, 3), dtype=np.uint8)
        m_imread.return_value = img

        res = read_stack_efectivo(self.tmp_path)
        self.assertFalse(res["ok"])
        self.assertEqual(res["error"], "roi_out_of_bounds")

    def test_missing_image(self):
        res = read_stack_efectivo("C:\\no_existe_stack.png")
        self.assertFalse(res["ok"])
        self.assertEqual(res["error"], "image_not_found")


if __name__ == "__main__":
    unittest.main()
