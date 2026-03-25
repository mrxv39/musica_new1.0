import unittest
# [test_id:BASE_OCR_Modular]
import tempfile
import shutil
import os
import json
import subprocess
from PIL import Image
import numpy as np

PREFLOP_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), '../modules/preflop/preflop.py'))
ROI_NB = (250, 230, 70, 70)
ROI_TIME = (350, 470, 50, 15)

class TestPreflop(unittest.TestCase):
    def setUp(self):
        self.tmpdir = tempfile.mkdtemp()
        self.img_path = os.path.join(self.tmpdir, 'synthetic_preflop.png')
        # Compose image for board_state preflop, time_ok True, mano likely False (unless templates present)
        img = Image.fromarray(np.full((500, 500), 100, dtype=np.uint8))
        # board_state: black patch where board cards should be absent
        img.paste(Image.fromarray(np.zeros((ROI_NB[3], ROI_NB[2]), dtype=np.uint8)), (ROI_NB[0], ROI_NB[1]))
        # time: white patch (to avoid false positives, but time.py expects template match, so may be False)
        img.paste(Image.fromarray(np.full((ROI_TIME[3], ROI_TIME[2]), 255, dtype=np.uint8)), (ROI_TIME[0], ROI_TIME[1]))
        img.save(self.img_path)
    def tearDown(self):
        shutil.rmtree(self.tmpdir)
    def run_preflop(self, image_path):
        proc = subprocess.run([
            'python', PREFLOP_PATH, '--image', image_path
        ], capture_output=True, text=True, timeout=15)
        return proc.stdout
    def test_missing_image(self):
        stdout = self.run_preflop(os.path.join(self.tmpdir, 'nonexistent.png'))
        data = json.loads(stdout)
        self.assertFalse(data['preflop_ok'])
        self.assertTrue(len(data['fingerprint']) > 0)
        self.assertIn('errors', data)
        self.assertTrue(data['errors'])
    def test_shape_and_flags(self):
        stdout = self.run_preflop(self.img_path)
        data = json.loads(stdout)
        self.assertIn('preflop_ok', data)
        self.assertIn('fingerprint', data)
        self.assertIn('modules', data)
        self.assertIn('mano', data['modules'])
        self.assertIn('time', data['modules'])
        self.assertIn('board_state', data['modules'])
        self.assertIsInstance(data['modules']['mano'], dict)
        self.assertIsInstance(data['modules']['time'], dict)
        self.assertIsInstance(data['modules']['board_state'], dict)
        self.assertTrue(len(data['fingerprint']) > 0)
        # preflop_ok must be mano_ok AND time_ok AND board_state.street_state == "preflop"
        mano_ok = bool(data['modules']['mano'].get('hand_class', '') and data['modules']['mano'].get('mano_raw', ''))
        time_ok = bool(data['modules']['time'].get('time_ok', False))
        board_preflop_ok = (str(data['modules']['board_state'].get('street_state', '')).strip().lower() == 'preflop')
        self.assertEqual(data['preflop_ok'], mano_ok and time_ok and board_preflop_ok)

if __name__ == '__main__':
    unittest.main()


