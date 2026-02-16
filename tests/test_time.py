import unittest
import tempfile
import shutil
import os
import json
import subprocess
from PIL import Image
import numpy as np

TIME_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), '../modules/preflop/time.py'))
ROI = (350, 470, 50, 15)
THRESHOLD = 0.85

def make_template():
    arr = np.zeros((10, 10), dtype=np.uint8)
    arr[::2, ::2] = 180
    arr[1::2, 1::2] = 220
    return Image.fromarray(arr)

class TestTime(unittest.TestCase):
    def setUp(self):
        self.tmpdir = tempfile.mkdtemp()
        self.tpl_path = os.path.join(self.tmpdir, 'time.bmp')
        tpl = make_template()
        tpl.save(self.tpl_path)
        # Create synthetic image
        img = Image.fromarray(np.full((500, 500), 100, dtype=np.uint8))
        # Paste template into ROI
        img.paste(tpl, (ROI[0], ROI[1]))
        self.img_path = os.path.join(self.tmpdir, 'synthetic_time.png')
        img.save(self.img_path)
    def tearDown(self):
        shutil.rmtree(self.tmpdir)
    def run_time(self, image_path):
        env = os.environ.copy()
        env['TIME_TEMPLATE_PATH'] = self.tpl_path
        proc = subprocess.run([
            'python', TIME_PATH, '--image', image_path
        ], capture_output=True, text=True, env=env, timeout=10)
        return proc.stdout
    def test_time_ok(self):
        stdout = self.run_time(self.img_path)
        data = json.loads(stdout)
        self.assertIn('time_ok', data)
        self.assertIn('score', data)
        self.assertIn('fingerprint', data)
        self.assertIsInstance(data['time_ok'], bool)
        self.assertIsInstance(data['score'], float)
        self.assertIsInstance(data['fingerprint'], str)
        self.assertTrue(len(data['fingerprint']) > 0)
        self.assertTrue(data['time_ok'])
        self.assertGreaterEqual(data['score'], THRESHOLD)
    def test_missing_image(self):
        stdout = self.run_time(os.path.join(self.tmpdir, 'nonexistent.png'))
        data = json.loads(stdout)
        self.assertFalse(data['time_ok'])
        self.assertTrue(len(data['fingerprint']) > 0)

if __name__ == '__main__':
    unittest.main()
