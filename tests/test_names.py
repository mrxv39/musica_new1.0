# tests/test_names.py
import unittest
from unittest.mock import patch
import numpy as np
import sys

# Mirror the pattern used by tests/test_stacks.py for stability across environments
sys.modules["cv2"] = __import__("cv2")
sys.modules["numpy"] = __import__("numpy")

from modules.ocr import names


class TestNamesOCR(unittest.TestCase):
    def setUp(self):
        # Large enough for both name ROIs (y=180,h=18; x up to 645+120)
        self.dummy_img = np.ones((220, 800), dtype=np.uint8) * 200

    @patch("cv2.imread")
    def test_missing_image(self, mock_imread):
        mock_imread.return_value = None
        out = names.read_names("missing.png")
        self.assertFalse(out["ok"])
        self.assertIn("imread_fail", "".join(out["errors"]))

    @patch("cv2.imread")
    @patch("pytesseract.image_to_string")
    def test_otsu_path(self, mock_ocr, mock_imread):
        mock_imread.return_value = self.dummy_img
        # For p2: otsu returns valid => no fallback call.
        # For p3: otsu returns valid => no fallback call.
        mock_ocr.side_effect = ["Player_One", "Player_Three"]
        out = names.read_names("dummy.png")
        self.assertTrue(out["ok"])
        self.assertEqual(out["p2_name"], "Player_One")
        self.assertEqual(out["p3_name"], "Player_Three")

    @patch("cv2.imread")
    @patch("pytesseract.image_to_string")
    def test_fallback_threshold_path(self, mock_ocr, mock_imread):
        mock_imread.return_value = self.dummy_img
        # Call order across both players:
        # p2 otsu, p2 fixed, p3 otsu, p3 fixed
        mock_ocr.side_effect = ["", "Player_Two", "", ""]
        out = names.read_names("dummy.png")
        self.assertTrue(out["ok"])
        self.assertEqual(out["p2_name"], "Player_Two")
        self.assertEqual(out["p3_name"], "")

    @patch("cv2.imread")
    @patch("pytesseract.image_to_string")
    def test_cleaning_rules(self, mock_ocr, mock_imread):
        mock_imread.return_value = self.dummy_img
        mock_ocr.side_effect = ["  __!@#J0hn__  ", "  __!@#J0hn__  "]
        out = names.read_names("dummy.png")
        self.assertEqual(out["p2_name"], "J0hn")
        self.assertEqual(out["p3_name"], "J0hn")
        self.assertTrue(out["ok"])

    @patch("cv2.imread")
    @patch("pytesseract.image_to_string")
    def test_ok_false_when_both_invalid(self, mock_ocr, mock_imread):
        mock_imread.return_value = self.dummy_img
        # Both players: otsu returns whitespace -> cleaned empty; fallback returns whitespace -> still empty
        mock_ocr.side_effect = ["   ", "   ", "   ", "   "]
        out = names.read_names("dummy.png")
        self.assertFalse(out["ok"])
        self.assertIn("no_valid_names", out["errors"])


if __name__ == "__main__":
    unittest.main()
