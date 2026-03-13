from __future__ import annotations

import json
import os
import re
from collections import Counter
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

try:
    import cv2
except Exception:  # pragma: no cover
    cv2 = None  # type: ignore

try:
    import numpy as np
except Exception:  # pragma: no cover
    np = None  # type: ignore

try:
    import pytesseract
except Exception:  # pragma: no cover
    pytesseract = None  # type: ignore


ROI_DEFAULT: Tuple[int, int, int, int] = (10, 20, 220, 32)

_ID_AFTER_LABEL_RE = re.compile(r"\bID\b\s*[:;#-]?\s*(\d{10,14})", re.IGNORECASE)
_LONG_DIGITS_RE = re.compile(r"(\d{10,14})")


@dataclass(frozen=True)
class GamecodeOCRResult:
    ok: bool
    value: Optional[str]
    raw_text: str
    roi: Tuple[int, int, int, int]
    error: str = ""


@dataclass(frozen=True)
class _Candidate:
    name: str
    value: str
    raw_text: str


def _safe_crop(img: "np.ndarray", x: int, y: int, w: int, h: int) -> Optional["np.ndarray"]:
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


def _preprocess_variants(gray: "np.ndarray") -> Dict[str, "np.ndarray"]:
    variants: Dict[str, "np.ndarray"] = {}

    den = cv2.GaussianBlur(gray, (3, 3), 0)
    h, w = den.shape[:2]
    scales = (
        ("x1_5", 1.5),
        ("x2", 2.0),
        ("x3", 3.0),
    )
    kernel = np.ones((2, 2), np.uint8)
    for scale_name, scale in scales:
        scaled = cv2.resize(
            den,
            (max(1, int(round(w * scale))), max(1, int(round(h * scale)))),
            interpolation=cv2.INTER_CUBIC,
        )

        _, otsu = cv2.threshold(scaled, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        variants[f"{scale_name}_otsu"] = otsu

        adaptive = cv2.adaptiveThreshold(
            scaled,
            255,
            cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY,
            31,
            11,
        )
        variants[f"{scale_name}_adaptive"] = adaptive

        _, inv_otsu = cv2.threshold(scaled, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
        variants[f"{scale_name}_otsu_inv"] = inv_otsu

    for key, value in list(variants.items()):
        variants[f"{key}_open"] = cv2.morphologyEx(value, cv2.MORPH_OPEN, kernel, iterations=1)

    return variants


def _normalize_text(text: str) -> str:
    if not text:
        return ""
    cleaned = text.replace("\n", " ").replace("\r", " ")
    cleaned = re.sub(r"\s+", " ", cleaned)
    return cleaned.strip()


def _extract_gamecode(text: str) -> Optional[str]:
    normalized = _normalize_text(text)
    if not normalized:
        return None

    m = _ID_AFTER_LABEL_RE.search(normalized)
    if m:
        return m.group(1)

    matches = _LONG_DIGITS_RE.findall(normalized)
    if not matches:
        return None

    return max(matches, key=len)


def _numeric_subroi(img: "np.ndarray") -> "np.ndarray":
    h, w = img.shape[:2]
    left = int(round(w * 0.24))
    right = int(round(w * 0.02))
    top = int(round(h * 0.08))
    bottom = int(round(h * 0.08))
    x0 = min(max(left, 0), max(w - 1, 0))
    x1 = max(x0 + 1, w - max(right, 0))
    y0 = min(max(top, 0), max(h - 1, 0))
    y1 = max(y0 + 1, h - max(bottom, 0))
    return img[y0:y1, x0:x1]


def _refine_digits_only(bin_img: "np.ndarray", fallback_value: str, fallback_text: str) -> Tuple[str, str]:
    digits_roi = _numeric_subroi(bin_img)
    if digits_roi.size == 0:
        return fallback_value, fallback_text

    digits_config = "--psm 8 -c tessedit_char_whitelist=0123456789"
    try:
        digits_text = pytesseract.image_to_string(digits_roi, config=digits_config)
    except Exception:
        return fallback_value, fallback_text

    normalized = _normalize_text(digits_text)
    refined = _extract_gamecode(normalized)
    if refined:
        return refined, normalized
    return fallback_value, fallback_text


def _choose_best_candidate(candidates: List[_Candidate]) -> _Candidate:
    if len(candidates) == 1:
        return candidates[0]

    counts = Counter(candidate.value for candidate in candidates)
    best_index = 0
    best_key: Tuple[int, int, int] = (-1, -1, 0)
    for index, candidate in enumerate(candidates):
        key = (counts[candidate.value], len(candidate.value), -index)
        if key > best_key:
            best_key = key
            best_index = index
    return candidates[best_index]


def read_gamecode(
    image_path: str,
    x1: int = 0,
    y1: int = 0,
    roi_rel: Tuple[int, int, int, int] = ROI_DEFAULT,
) -> Dict[str, Any]:
    dx, dy, w, h = roi_rel
    x = int(x1 + dx)
    y = int(y1 + dy)
    roi_abs = (x, y, int(w), int(h))

    if cv2 is None:
        return GamecodeOCRResult(
            ok=False,
            value=None,
            raw_text="",
            roi=roi_abs,
            error="cv2_not_available",
        ).__dict__

    if np is None:
        return GamecodeOCRResult(
            ok=False,
            value=None,
            raw_text="",
            roi=roi_abs,
            error="numpy_not_available",
        ).__dict__

    if pytesseract is None:
        return GamecodeOCRResult(
            ok=False,
            value=None,
            raw_text="",
            roi=roi_abs,
            error="pytesseract_not_available",
        ).__dict__

    if not image_path or not os.path.exists(image_path):
        return GamecodeOCRResult(
            ok=False,
            value=None,
            raw_text="",
            roi=roi_abs,
            error="image_not_found",
        ).__dict__

    img = cv2.imread(image_path)
    if img is None:
        return GamecodeOCRResult(
            ok=False,
            value=None,
            raw_text="",
            roi=roi_abs,
            error="cv2_imread_failed",
        ).__dict__

    crop = _safe_crop(img, x, y, w, h)
    if crop is None:
        return GamecodeOCRResult(
            ok=False,
            value=None,
            raw_text="",
            roi=roi_abs,
            error="roi_out_of_bounds",
        ).__dict__

    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)

    if os.environ.get("OCR_DEBUG_GAMECODE", "0") == "1":
        try:
            cv2.imwrite("gamecode_roi.png", crop)
        except Exception:
            pass

    config = "--psm 7 -c tessedit_char_whitelist=ID:id0123456789:;#-"

    variants = _preprocess_variants(gray)
    raw_candidates: List[str] = []
    valid_candidates: List[_Candidate] = []

    for name, bin_img in variants.items():
        try:
            txt = pytesseract.image_to_string(bin_img, config=config)
        except Exception:
            continue
        normalized = _normalize_text(txt)
        raw_candidates.append(normalized)
        value = _extract_gamecode(normalized)
        if value:
            refined_value, refined_text = _refine_digits_only(bin_img, value, normalized)
            valid_candidates.append(_Candidate(name=name, value=refined_value, raw_text=refined_text))

    try:
        gray_txt = pytesseract.image_to_string(gray, config=config)
    except Exception:
        gray_txt = ""

    gray_normalized = _normalize_text(gray_txt)
    raw_candidates.append(gray_normalized)
    value = _extract_gamecode(gray_normalized)
    if value:
        refined_value, refined_text = _refine_digits_only(gray, value, gray_normalized)
        valid_candidates.append(_Candidate(name="gray", value=refined_value, raw_text=refined_text))

    if valid_candidates:
        winner = _choose_best_candidate(valid_candidates)
        return GamecodeOCRResult(
            ok=True,
            value=winner.value,
            raw_text=winner.raw_text,
            roi=roi_abs,
        ).__dict__

    raw_text = next((candidate for candidate in raw_candidates if candidate), "")
    return GamecodeOCRResult(
        ok=False,
        value=None,
        raw_text=raw_text,
        roi=roi_abs,
        error="gamecode_not_found",
    ).__dict__


if __name__ == "__main__":
    import sys

    image_path = None
    if "--image" in sys.argv:
        try:
            image_path = sys.argv[sys.argv.index("--image") + 1]
        except Exception:
            image_path = None

    res = read_gamecode(image_path) if image_path else {
        "ok": False,
        "value": None,
        "raw_text": "",
        "roi": ROI_DEFAULT,
        "error": "no_image",
    }
    print(json.dumps(res, ensure_ascii=False))
