import sys
import os
import json
import time as t
import hashlib
from PIL import Image
import numpy as np

ROI = (350, 470, 50, 15)
THRESHOLD = 0.85
DEFAULT_TEMPLATE_PATH = os.path.join(os.path.dirname(__file__), 'templates', 'time.bmp')
TEMPLATE_PATH = os.environ.get('TIME_TEMPLATE_PATH', DEFAULT_TEMPLATE_PATH)

def _fingerprint(image_path: str) -> str:
    abs_path = os.path.abspath(image_path) if image_path else ''
    return hashlib.sha1((abs_path + "|time|" + str(int(t.time()) // 2)).encode()).hexdigest()


def run_time(image_path: str) -> dict:
    """Direct-call entry point (no subprocess). Returns the same dict as main()."""
    import cv2
    try:
        abs_image_path = os.path.abspath(image_path)
        if not os.path.exists(abs_image_path):
            raise Exception('Image not found')
        if not os.path.exists(TEMPLATE_PATH):
            raise Exception('Template not found')
        img = Image.open(abs_image_path).convert('L')
        arr = np.array(img, dtype=np.uint8)
        x, y, w, h = ROI
        # If image is already the size of the ROI (pre-cropped), use it directly
        if arr.shape[0] <= h * 2 and arr.shape[1] <= w * 2:
            roi = arr
        elif arr.shape[0] < y + h or arr.shape[1] < x + w:
            raise Exception('ROI out of bounds')
        else:
            roi = arr[y:y+h, x:x+w]
        tpl = Image.open(TEMPLATE_PATH).convert('L')
        tpl_arr = np.array(tpl, dtype=np.uint8)
        res = cv2.matchTemplate(roi, tpl_arr, cv2.TM_CCOEFF_NORMED)
        _, max_val, _, _ = cv2.minMaxLoc(res)
        score = float(max_val)
        time_ok = bool(score >= THRESHOLD)
        return {"time_ok": time_ok, "score": score, "fingerprint": _fingerprint(abs_image_path)}
    except Exception as e:
        return {"time_ok": False, "score": 0.0, "fingerprint": _fingerprint(image_path), "error": str(e)}


def main():
    if '--image' not in sys.argv:
        out = {"time_ok": False, "score": 0.0, "fingerprint": _fingerprint(''), "error": "Missing --image argument"}
        print(json.dumps(out))
        return
    image_path = sys.argv[sys.argv.index('--image') + 1]
    out = run_time(image_path)
    print(json.dumps(out))


if __name__ == '__main__':
    main()