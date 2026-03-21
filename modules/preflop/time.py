# C:\Users\Usuario\Desktop\proyectos\poker_boss\modules\preflop\time.py
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
    abs_image_path = os.path.abspath(image_path) if image_path else ''
    return hashlib.sha1((abs_image_path + "|time|" + str(int(t.time()) // 2)).encode()).hexdigest()


def run_time(image_path: str) -> dict:
    """Direct-call entry point (no subprocess). Returns the same dict as main()."""
    import cv2
    abs_image_path = os.path.abspath(image_path)
    try:
        if not os.path.exists(abs_image_path):
            raise Exception('Image not found')
        if not os.path.exists(TEMPLATE_PATH):
            raise Exception('Template not found')

        img = Image.open(abs_image_path).convert('L')
        arr = np.array(img, dtype=np.uint8)
        tpl = Image.open(TEMPLATE_PATH).convert('L')
        tpl_arr = np.array(tpl, dtype=np.uint8)

        img_h, img_w = arr.shape[:2]
        tpl_h, tpl_w = tpl_arr.shape[:2]
        x, y, w, h = ROI
        mode = 'unknown'

        if img_h == tpl_h and img_w == tpl_w:
            roi = arr
            mode = 'exact_template_size'
        elif img_h < y + h or img_w < x + w:
            roi = arr
            mode = 'pre_cropped_time_roi'
        else:
            roi = arr[y:y + h, x:x + w]
            mode = 'cropped_from_full_table'

        roi_h, roi_w = roi.shape[:2]
        if roi_h < tpl_h or roi_w < tpl_w:
            raise Exception(f'template larger than roi | roi={roi_w}x{roi_h} | tpl={tpl_w}x{tpl_h}')

        res = cv2.matchTemplate(roi, tpl_arr, cv2.TM_CCOEFF_NORMED)
        _, max_val, _, _ = cv2.minMaxLoc(res)
        score = float(max_val)
        time_ok = bool(score >= THRESHOLD)

        return {
            "time_ok": time_ok, "score": score,
            "fingerprint": _fingerprint(abs_image_path), "mode": mode,
            "image_w": img_w, "image_h": img_h,
            "roi_w": roi_w, "roi_h": roi_h,
            "tpl_w": tpl_w, "tpl_h": tpl_h, "threshold": THRESHOLD,
        }
    except Exception as e:
        return {
            "time_ok": False, "score": 0.0,
            "fingerprint": _fingerprint(image_path), "error": str(e),
        }


def main():
    try:
        try:
            import cv2
        except ImportError:
            raise Exception('cv2_missing')

        if '--image' not in sys.argv:
            raise Exception('Missing --image argument')

        image_path = sys.argv[sys.argv.index('--image') + 1]
        abs_image_path = os.path.abspath(image_path)

        if not os.path.exists(abs_image_path):
            raise Exception('Image not found')

        if not os.path.exists(TEMPLATE_PATH):
            raise Exception('Template not found')

        img = Image.open(abs_image_path).convert('L')
        arr = np.array(img, dtype=np.uint8)

        tpl = Image.open(TEMPLATE_PATH).convert('L')
        tpl_arr = np.array(tpl, dtype=np.uint8)

        img_h, img_w = arr.shape[:2]
        tpl_h, tpl_w = tpl_arr.shape[:2]

        x, y, w, h = ROI

        mode = 'unknown'

        # Caso 1: imagen exacta al template
        if img_h == tpl_h and img_w == tpl_w:
            roi = arr
            mode = 'exact_template_size'

        # Caso 2: imagen ya recortada del reloj por mesa (time_gate / build_time_bbox)
        # Debe respetarse tal cual y NO reaplicar la ROI legacy.
        elif img_h < y + h or img_w < x + w:
            roi = arr
            mode = 'pre_cropped_time_roi'

        # Caso 3: imagen completa de mesa -> recortar ROI interna legacy
        else:
            roi = arr[y:y + h, x:x + w]
            mode = 'cropped_from_full_table'

        roi_h, roi_w = roi.shape[:2]
        if roi_h < tpl_h or roi_w < tpl_w:
            raise Exception(
                f'template larger than roi | roi={roi_w}x{roi_h} | tpl={tpl_w}x{tpl_h}'
            )

        res = cv2.matchTemplate(roi, tpl_arr, cv2.TM_CCOEFF_NORMED)
        _min_val, max_val, _min_loc, _max_loc = cv2.minMaxLoc(res)
        score = float(max_val)
        time_ok = bool(score >= THRESHOLD)

        out = {
            "time_ok": time_ok,
            "score": score,
            "fingerprint": _fingerprint(abs_image_path),
            "mode": mode,
            "image_w": img_w,
            "image_h": img_h,
            "roi_w": roi_w,
            "roi_h": roi_h,
            "tpl_w": tpl_w,
            "tpl_h": tpl_h,
            "threshold": THRESHOLD,
        }
        print(json.dumps(out))
    except Exception as e:
        try:
            image_path = sys.argv[sys.argv.index('--image') + 1] if '--image' in sys.argv else ''
        except Exception:
            image_path = ''

        out = {
            "time_ok": False,
            "score": 0.0,
            "fingerprint": _fingerprint(image_path),
            "error": str(e),
        }
        print(json.dumps(out))


if __name__ == '__main__':
    main()
