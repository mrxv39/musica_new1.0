import json
import os
import subprocess
import tempfile

import numpy as np
from PIL import Image


TIME_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "../modules/preflop/time.py"))


def test_time_accepts_precropped_small_roi_without_legacy_out_of_bounds():
    with tempfile.TemporaryDirectory() as tmpdir:
        img_path = os.path.join(tmpdir, "time_precropped.bmp")

        # Imagen pequeña similar a la ROI capturada por mesa
        arr = np.full((20, 60), 255, dtype=np.uint8)
        Image.fromarray(arr).save(img_path)

        proc = subprocess.run(
            ["python", TIME_PATH, "--image", img_path],
            capture_output=True,
            text=True,
            timeout=10,
        )

        assert proc.returncode == 0
        data = json.loads(proc.stdout)

        assert isinstance(data, dict)
        assert "time_ok" in data

        err = str(data.get("error", "") or "")
        assert "ROI out of bounds" not in err

        # Debe usar la imagen completa pre-recortada, no la ROI legacy de mesa completa
        assert data.get("mode") in ("pre_cropped_time_roi", "exact_template_size", "small_input_full")
