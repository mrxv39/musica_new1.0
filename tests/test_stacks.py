import unittest
from unittest.mock import patch, MagicMock
import numpy as np
import sys
import os

sys.modules['cv2'] = __import__('cv2')
sys.modules['numpy'] = __import__('numpy')

from modules.ocr import stacks

class TestStacksOCR(unittest.TestCase):
    def setUp(self):
        self.dummy_img = np.ones((600, 800), dtype=np.uint8) * 200  # Large enough for all ROIs

    @patch('cv2.imread')
    def test_missing_image(self, mock_imread):
        mock_imread.return_value = None
        out = stacks.read_stacks('missing.png')
        self.assertFalse(out['ok'])
        self.assertIn('imread_fail', ''.join(out['errors']))

    @patch('cv2.imread')
    @patch('pytesseract.image_to_string')
    def test_ok_path_at_least_one_roi_ok(self, mock_ocr, mock_imread):
        mock_imread.return_value = self.dummy_img
        # Always return '245' so it parses as 24.5
        mock_ocr.return_value = '245'
        out = stacks.read_stacks('dummy.png')
        self.assertTrue(out['ok'])
        self.assertEqual(out['p1'], 24.5)
        self.assertEqual(out['p2'], 24.5)
        self.assertEqual(out['p3'], 24.5)
        self.assertEqual(out['raw']['p1'], '245')
        self.assertEqual(out['raw']['p2'], '245')
        self.assertEqual(out['raw']['p3'], '245')
        self.assertEqual(out['method']['p1'], 'otsu')  # Should be first method

    @patch('cv2.imread')
    def test_roi_out_of_bounds_ok_false_if_none_ok(self, mock_imread):
        # Tiny image so all ROIs are out of bounds
        mock_imread.return_value = np.ones((10, 10), dtype=np.uint8)
        out = stacks.read_stacks('tiny.png')
        self.assertFalse(out['ok'])
        self.assertIn('p1:roi_out_of_bounds', out['errors'])
        self.assertIn('p2:roi_out_of_bounds', out['errors'])
        self.assertIn('p3:roi_out_of_bounds', out['errors'])

if __name__ == '__main__':
    unittest.main()
