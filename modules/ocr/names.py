# modules/ocr/names.py
# OCR player names for P2 and P3 using legacy ROIs and robust preprocessing.
# Follows the style and conventions of stacks.py and other OCR modules.

from __future__ import annotations

import os
import re
from typing import Dict, Optional, Tuple, Any

import cv2
import numpy as np

try:
    import pytesseract
except Exception:  # pragma: no cover
    pytesseract = None  # type: ignore

# Legacy ROIs for player names (relative to x1, y1)
ROI_P2NAME = (70, 180, 120, 18)
ROI_P3NAME = (645, 180, 120, 18)

THRESH_FALLBACK = 220

ALLOWED_CHARS = re.compile(r"[^A-Za-z0-9_]")


def _safe_crop(img: np.ndarray, x: int, y: int, w: int, h: int):
    if img is None:
        return None
    ih, iw = img.shape[:2]
    if w <= 0 or h <= 0 or x < 0 or y < 0 or x + w > iw or y + h > ih:
        return None
    return img[y : y + h, x : x + w]


def _preprocess_otsu(gray: np.ndarray):
    h, w = gray.shape[:2]
    up = cv2.resize(gray, (w * 2, h * 2), interpolation=cv2.INTER_CUBIC)
    up = cv2.GaussianBlur(up, (3, 3), 0)
    _, otsu = cv2.threshold(up, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    return otsu


def _preprocess_fixed(gray: np.ndarray, thr: int):
    h, w = gray.shape[:2]
    up = cv2.resize(gray, (w * 2, h * 2), interpolation=cv2.INTER_CUBIC)
    up = cv2.GaussianBlur(up, (3, 3), 0)
    _, fixed = cv2.threshold(up, thr, 255, cv2.THRESH_BINARY)
    return fixed


def _clean_name(text: str) -> str:
    if not text:
        return ""
    t = ALLOWED_CHARS.sub("", text)
    t = re.sub(r"\s+", "", t)
    t = t.strip("_")
    return t


def _ocr_name(img_gray: np.ndarray, roi: Tuple[int, int, int, int], label: str) -> str:
    crop = _safe_crop(img_gray, *roi)
    if crop is None:
        return ""
    # Debug: save raw crop if env set
    if os.environ.get("OCR_DEBUG_NAMES", "0") == "1":
        try:
            os.makedirs("preflop/crops", exist_ok=True)
            cv2.imwrite(os.path.join("preflop/crops", f"{label}name_roi.png"), crop)
        except Exception:
            pass
    if pytesseract is None:
        return ""

    config = "--psm 7"

    # Try Otsu first
    try:
        otsu = _preprocess_otsu(crop)
        txt = pytesseract.image_to_string(otsu, config=config)
        cleaned = _clean_name(txt)
        if cleaned:
            return cleaned
    except Exception:
        pass

    # Fallback: fixed threshold
    try:
        fixed = _preprocess_fixed(crop, THRESH_FALLBACK)
        txt = pytesseract.image_to_string(fixed, config=config)
        cleaned = _clean_name(txt)
        if cleaned:
            return cleaned
    except Exception:
        pass

    return ""


def read_names(
    image_path: str,
    x1: int = 0,
    y1: int = 0,
    roi_p2: Tuple[int, int, int, int] = ROI_P2NAME,
    roi_p3: Tuple[int, int, int, int] = ROI_P3NAME,
    img_gray: Optional[np.ndarray] = None,
) -> Dict[str, Any]:
    out = {
        "ok": False,
        "p2_name": "",
        "p3_name": "",
        "roi": {
            "p2": [int(x1 + roi_p2[0]), int(y1 + roi_p2[1]), int(roi_p2[2]), int(roi_p2[3])],
            "p3": [int(x1 + roi_p3[0]), int(y1 + roi_p3[1]), int(roi_p3[2]), int(roi_p3[3])],
        },
        "errors": [],
    }
    if img_gray is not None:
        img = img_gray
    else:
        img = cv2.imread(image_path, cv2.IMREAD_GRAYSCALE)
    if img is None:
        out["errors"].append("imread_fail")
        return out

    rx2, ry2, rw2, rh2 = out["roi"]["p2"]
    rx3, ry3, rw3, rh3 = out["roi"]["p3"]

    out["p2_name"] = _ocr_name(img, (rx2, ry2, rw2, rh2), "p2")
    out["p3_name"] = _ocr_name(img, (rx3, ry3, rw3, rh3), "p3")

    out["ok"] = bool(out["p2_name"] or out["p3_name"])
    if not out["ok"]:
        out["errors"].append("no_valid_names")
    return out


if __name__ == "__main__":
    import sys, json

    image_path = None
    if "--image" in sys.argv:
        try:
            image_path = sys.argv[sys.argv.index("--image") + 1]
        except Exception:
            image_path = None
    res = read_names(image_path) if image_path else {"ok": False, "errors": ["no_image"]}
    print(
        json.dumps(
            {"p2_name": res.get("p2_name", ""), "p3_name": res.get("p3_name", ""), "ok": res.get("ok", False)},
            ensure_ascii=False,
        )
    )
