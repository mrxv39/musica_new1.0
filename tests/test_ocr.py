import unittest
# [test_id:BASE_OCR_Modular]
from unittest.mock import patch, call
from modules.ocr import ocr

class TestOCROrchestrator(unittest.TestCase):
    @patch('modules.ocr.bets.read_bets')
    @patch('modules.ocr.stacks.read_stacks')
    @patch('modules.ocr.names.read_names')
    @patch('modules.ocr.villano.classify_villano')
    def test_ocr_orchestration(self, mock_villano, mock_names, mock_stacks, mock_bets):
        # Set up deterministic return values
        mock_bets.return_value = {'ok': False, 'errors': ['fail_bets']}
        mock_stacks.return_value = {'ok': False, 'errors': []}
        mock_names.return_value = {'ok': True, 'p2_name': 'A', 'p3_name': '', 'errors': []}
        mock_villano.return_value = {'ok': True, 'p2': {'name': 'A', 'tipo': 'fish'}, 'p3': {'name': '', 'tipo': ''}, 'created': ['p2'], 'errors': []}

        out = ocr.run_ocr('img.png')
        self.assertTrue(out['ok'])
        self.assertEqual(out['stackefectivo'], {})
        self.assertEqual(out['bets']['ok'], False)
        self.assertEqual(out['names']['p2_name'], 'A')
        self.assertEqual(out['villano']['p2']['tipo'], 'fish')
        self.assertIn('stackefectivo', out)
        self.assertIn('bets', out)
        self.assertIn('stacks', out)
        self.assertIn('names', out)
        self.assertIn('villano', out)
        # Error aggregation
        self.assertIn('bets:fail_bets', out['errors'])
        # Villano called with precomputed names
        mock_villano.assert_called_with(image_path='img.png', x1=0, y1=0, p2_name='A', p3_name='')

    @patch('modules.ocr.bets.read_bets', side_effect=Exception('fail_bets'))
    @patch('modules.ocr.stacks.read_stacks', side_effect=Exception('fail_stacks'))
    @patch('modules.ocr.names.read_names', side_effect=Exception('fail_names'))
    @patch('modules.ocr.villano.classify_villano', side_effect=Exception('fail_villano'))
    def test_ocr_all_failures(self, mock_villano, mock_names, mock_stacks, mock_bets):
        out = ocr.run_ocr('img.png')
        self.assertFalse(out['ok'])
        self.assertEqual(out['stackefectivo'], {})
        self.assertIn('bets:fail_bets', out['errors'])
        self.assertIn('stacks:fail_stacks', out['errors'])
        self.assertIn('names:fail_names', out['errors'])
        self.assertIn('villano:fail_villano', out['errors'])

if __name__ == '__main__':
    unittest.main()
