# C:\Users\Usuario\Desktop\proyectos\musica_new\modules\preflop\noboard.py
import sys
import os
import json
import time as t
import hashlib
from PIL import Image
import numpy as np

# ROI donde aparecen las cartas comunitarias (board). Si NO hay board, esta zona queda oscura/uniforme.
ROI = (250, 230, 70, 70)

# Umbrales deterministas (porteados de encontrar_noboard.py)
MEAN_MAX = 35.0
STD_MAX = 18.0
DARK_THR = 45
DARK_MIN_RATIO = 0.85


def _sha1(s: str) -> str:
    return hashlib.sha1(s.encode("utf-8", errors="ignore")).hexdigest()


def _fingerprint_fallback(image_path: str) -> str:
    # Fingerprint NO vacío incluso en error
    abs_path = os.path.abspath(image_path or "")
    return _sha1(abs_path + "|noboard|" + str(int(t.time()) // 2))


def main() -> None:
    try:
        if "--image" not in sys.argv:
            raise Exception("Missing --image argument")

        image_path = sys.argv[sys.argv.index("--image") + 1]
        abs_image_path = os.path.abspath(image_path)

        if not os.path.exists(abs_image_path):
            raise Exception("Image not found")

        img = Image.open(abs_image_path).convert("L")
        arr = np.array(img, dtype=np.uint8)

        x, y, w, h = ROI
        if arr.shape[0] < y + h or arr.shape[1] < x + w:
            raise Exception("ROI out of bounds")

        roi = arr[y : y + h, x : x + w]

        mean_val = float(roi.mean())
        std_val = float(roi.std())
        dark_ratio = float((roi < DARK_THR).sum()) / float(roi.size)

        noboard_ok = (mean_val <= MEAN_MAX) and (std_val <= STD_MAX) and (dark_ratio >= DARK_MIN_RATIO)

        fingerprint = _sha1(abs_image_path + "|noboard|" + str(int(t.time()) // 2))

        out = {
            "noboard_ok": bool(noboard_ok),
            "mean": mean_val,
            "std": std_val,
            "dark_ratio": dark_ratio,
            "fingerprint": fingerprint,
        }
        print(json.dumps(out))
        return

    except Exception as e:
        # JSON estable incluso en error
        try:
            image_path = sys.argv[sys.argv.index("--image") + 1] if "--image" in sys.argv else ""
        except Exception:
            image_path = ""

        fp = _fingerprint_fallback(image_path)
        out = {
            "noboard_ok": False,
            "mean": 0.0,
            "std": 0.0,
            "dark_ratio": 0.0,
            "fingerprint": fp,
            "error": str(e),
        }
        print(json.dumps(out))
        return


if __name__ == "__main__":
    main()
