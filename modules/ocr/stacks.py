# C:\Users\Usuario\Desktop\proyectos\poker_boss\modules\ocr\stacks.py
# OCR stacks (player stacks) in 3 ROIs, robust, deterministic, testable.
# Based on encontrar_stacks.py legacy logic, refactored for robustness and testability.

from __future__ import annotations

import logging
import os
import re
from typing import Dict, Tuple, Optional, Any

import cv2
import numpy as np

try:
    import pytesseract
except Exception:  # pragma: no cover
    pytesseract = None  # type: ignore

from modules.ocr import tess_counter

# ROIs relative to x1, y1
ROI_P2STACK = (70, 198, 60, 18)
ROI_P3STACK = (645, 198, 60, 18)
ROI_P1STACK = (350, 485, 60, 18)

# Legacy thresholds (fallback only)
THR_P2 = 230
THR_P3 = 250
THR_P1 = 250

_FLOAT_RE = re.compile(r"(\d+(?:[.,]\d+)?)")

def _safe_crop(img: np.ndarray, x: int, y: int, w: int, h: int) -> Optional[np.ndarray]:
    if img is None:
        return None
    ih, iw = img.shape[:2]
    if w <= 0 or h <= 0:
        return None
    if x < 0 or y < 0:
        return None
    if x + w > iw or y + h > ih:
        return None
    return img[y : y + h, x : x + w]

def _clean_numeric_text(text: str) -> str:
    t = (text or "").replace(",", ".")
    t = re.sub(r"[^0-9.]", "", t)
    t = re.sub(r"\.{2,}", ".", t)
    if t.count(".") > 1:
        first = t.find(".")
        t = t[: first + 1] + t[first + 1 :].replace(".", "")
    return t.strip(".")

def _parse_stack_value(cleaned: str) -> Optional[float]:
    if not cleaned:
        return None
    try:
        if "." in cleaned:
            return float(cleaned)
        n = int(cleaned)
        if 100 <= n <= 999:
            return n / 10.0
        return float(n)
    except Exception:
        return None

def _preprocess_variants(gray: np.ndarray) -> Dict[str, np.ndarray]:
    variants: Dict[str, np.ndarray] = {}
    h, w = gray.shape[:2]
    up = cv2.resize(gray, (w * 4, h * 4), interpolation=cv2.INTER_NEAREST)
    up = cv2.GaussianBlur(up, (3, 3), 0)
    # Otsu normal
    _, otsu = cv2.threshold(up, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    variants["otsu"] = otsu
    # Otsu inverted
    variants["otsu_inv"] = cv2.bitwise_not(otsu)
    return variants

def _preprocess_legacy(gray: np.ndarray, thr: int) -> Dict[str, np.ndarray]:
    variants: Dict[str, np.ndarray] = {}
    h, w = gray.shape[:2]
    up = cv2.resize(gray, (w * 4, h * 4), interpolation=cv2.INTER_NEAREST)
    up = cv2.GaussianBlur(up, (3, 3), 0)
    _, norm = cv2.threshold(up, thr, 255, cv2.THRESH_BINARY)
    variants["thr"] = norm
    variants["thr_inv"] = cv2.bitwise_not(norm)
    return variants

def _ocr_one_stack(img_gray: np.ndarray, x: int, y: int, w: int, h: int, label: str, thr: int) -> Dict[str, Any]:
    crop = _safe_crop(img_gray, x, y, w, h)
    if crop is None:
        return {
            "ok": False,
            "value": 0.0,
            "raw_text": "",
            "roi": (x, y, w, h),
            "method": "failed",
            "error": "roi_out_of_bounds",
        }
    # Debug: save raw crop if env set
    if os.environ.get("OCR_DEBUG_STACKS", "0") == "1":
        try:
            os.makedirs("preflop/crops", exist_ok=True)
            cv2.imwrite(os.path.join("preflop/crops", f"{label}stack_roi.png"), crop)
        except Exception:
            pass
    if pytesseract is None:
        return {
            "ok": False,
            "value": 0.0,
            "raw_text": "",
            "roi": (x, y, w, h),
            "method": "none",
            "error": "pytesseract_not_available",
        }
    config = "--psm 7 -c tessedit_char_whitelist=0123456789."
    # Try Otsu normal, then Otsu inv
    for method, bin_img in _preprocess_variants(crop).items():
        try:
            tess_counter.inc(f"stacks:{label}:{method}")
            txt = pytesseract.image_to_string(bin_img, config=config)
        except Exception:
            continue
        cleaned = _clean_numeric_text(txt)
        val = _parse_stack_value(cleaned)
        if val and val > 0:
            return {
                "ok": True,
                "value": float(val),
                "raw_text": cleaned,
                "roi": (x, y, w, h),
                "method": method,
                "error": "",
            }
    # Fallback: legacy threshold (normal, then inv)
    for method, bin_img in _preprocess_legacy(crop, thr).items():
        try:
            tess_counter.inc(f"stacks:{label}:legacy_{method}")
            txt = pytesseract.image_to_string(bin_img, config=config)
        except Exception:
            continue
        cleaned = _clean_numeric_text(txt)
        val = _parse_stack_value(cleaned)
        if val and val > 0:
            return {
                "ok": True,
                "value": float(val),
                "raw_text": cleaned,
                "roi": (x, y, w, h),
                "method": method,
                "error": "",
            }
    # If all fail
    return {
        "ok": False,
        "value": 0.0,
        "raw_text": "",
        "roi": (x, y, w, h),
        "method": "failed",
        "error": "ocr_failed",
    }

def read_stacks(
    image_path: str,
    x1: int = 0,
    y1: int = 0,
    roi_p1: Tuple[int, int, int, int] = ROI_P1STACK,
    roi_p2: Tuple[int, int, int, int] = ROI_P2STACK,
    roi_p3: Tuple[int, int, int, int] = ROI_P3STACK,
    thr_p1: int = THR_P1,
    thr_p2: int = THR_P2,
    thr_p3: int = THR_P3,
    img_gray: Optional[np.ndarray] = None,
) -> Dict[str, Any]:
    out: Dict[str, Any] = {
        "ok": False,
        "p1": 0.0,
        "p2": 0.0,
        "p3": 0.0,
        "raw": {"p1": "", "p2": "", "p3": ""},
        "roi": {
            "p1": [int(x1 + roi_p1[0]), int(y1 + roi_p1[1]), int(roi_p1[2]), int(roi_p1[3])],
            "p2": [int(x1 + roi_p2[0]), int(y1 + roi_p2[1]), int(roi_p2[2]), int(roi_p2[3])],
            "p3": [int(x1 + roi_p3[0]), int(y1 + roi_p3[1]), int(roi_p3[2]), int(roi_p3[3])],
        },
        "method": {"p1": "", "p2": "", "p3": ""},
        "errors": [],
    }
    if img_gray is not None:
        img = img_gray
    else:
        img = cv2.imread(image_path, cv2.IMREAD_GRAYSCALE)
    if img is None:
        out["errors"].append("imread_fail")
        return out
    results: Dict[str, Any] = {}
    all_out_of_bounds = True
    for key, roi, thr in zip(
        ("p1", "p2", "p3"),
        (out["roi"]["p1"], out["roi"]["p2"], out["roi"]["p3"]),
        (thr_p1, thr_p2, thr_p3),
    ):
        rx, ry, rw, rh = roi
        result = _ocr_one_stack(img, rx, ry, rw, rh, label=key, thr=thr)
        results[key] = result
        out[key] = result["value"]
        out["raw"][key] = result["raw_text"]
        out["method"][key] = result["method"]
        if not result["ok"]:
            out["errors"].append(f"{key}:{result['error']}")
        if result["error"] != "roi_out_of_bounds":
            all_out_of_bounds = False
    # ok = True if at least one ROI is not out_of_bounds and is ok
    out["ok"] = any(r["ok"] and r["error"] != "roi_out_of_bounds" for r in results.values())
    # If all ROIs are out of bounds, errors should only be roi_out_of_bounds
    if all_out_of_bounds:
        out["ok"] = False
    return out

if __name__ == "__main__":
    import sys, json
    image_path = None
    if "--image" in sys.argv:
        try:
            image_path = sys.argv[sys.argv.index("--image") + 1]
        except Exception:
            image_path = None
    res = read_stacks(image_path) if image_path else {"ok": False, "errors": ["no_image"]}
    print(json.dumps(res, ensure_ascii=False))
