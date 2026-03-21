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


ROI_DEFAULT: Tuple[int, int, int, int] = (48, 33, 165, 17)

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


@dataclass(frozen=True)
class _OCRConfig:
    roi_rel: Tuple[int, int, int, int]
    full_psm: int
    refine_psm: int
    full_whitelist: str = "ID:id0123456789:;#-"
    refine_whitelist: str = "0123456789"


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


def _to_black_on_white(gray: "np.ndarray", threshold: int = 200) -> "np.ndarray":
    _, binary = cv2.threshold(gray, int(threshold), 255, cv2.THRESH_BINARY)
    return 255 - binary


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


def _normalize_twister_gamecode(raw: str) -> Optional[str]:
    digits = re.sub(r"\D+", "", str(raw or ""))
    if not digits:
        return None

    # Exact 11 digits starting with "121"
    if len(digits) == 11 and digits.startswith("121"):
        return digits

    # 12 digits: spurious leading digit, try removing it
    if len(digits) == 12 and digits[1:].startswith("121"):
        return digits[1:]

    # Longer: find "121" substring and extract 11 digits from there
    if len(digits) > 11:
        pivot = -1
        for i in range(len(digits) - 10):
            if digits[i:i+3] == "121":
                pivot = i
                break
        if pivot >= 0 and pivot + 11 <= len(digits):
            return digits[pivot : pivot + 11]

    return None


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


def _refine_digits_only(
    bin_img: "np.ndarray",
    fallback_value: str,
    fallback_text: str,
    *,
    refine_psm: int = 8,
    whitelist: str = "0123456789",
) -> Tuple[str, str]:
    digits_roi = _numeric_subroi(bin_img)
    if digits_roi.size == 0:
        return fallback_value, fallback_text

    digits_config = f"--psm {int(refine_psm)} -c tessedit_char_whitelist={whitelist}"
    try:
        digits_text = pytesseract.image_to_string(digits_roi, config=digits_config)
    except Exception:
        return fallback_value, fallback_text

    normalized = _normalize_text(digits_text)
    refined = _normalize_twister_gamecode(normalized) or _extract_gamecode(normalized)
    if refined:
        return refined, normalized
    return fallback_value, fallback_text


def _candidate_rank(candidate: _Candidate, count: int, index: int) -> Tuple[int, int, int, int]:
    normalized = _normalize_twister_gamecode(candidate.value)
    is_valid = int(bool(normalized))
    normalized_len = len(normalized or "")
    raw_len = len(candidate.value)
    return (is_valid, count, normalized_len, raw_len, -index)


def _choose_best_candidate(candidates: List[_Candidate]) -> _Candidate:
    if len(candidates) == 1:
        candidate = candidates[0]
        normalized = _normalize_twister_gamecode(candidate.value)
        if normalized:
            return _Candidate(name=candidate.name, value=normalized, raw_text=candidate.raw_text)
        return candidate

    counts = Counter(candidate.value for candidate in candidates)
    best_index = 0
    best_key: Tuple[int, int, int, int, int] = (-1, -1, -1, -1, 0)
    for index, candidate in enumerate(candidates):
        key = _candidate_rank(candidate, counts[candidate.value], index)
        if key > best_key:
            best_key = key
            best_index = index
    winner = candidates[best_index]
    normalized = _normalize_twister_gamecode(winner.value)
    if normalized:
        return _Candidate(name=winner.name, value=normalized, raw_text=winner.raw_text)
    return winner


def _read_gamecode_impl(
    image_path: str,
    x1: int,
    y1: int,
    config_obj: _OCRConfig,
    img: Optional["np.ndarray"] = None,
) -> Dict[str, Any]:
    dx, dy, w, h = config_obj.roi_rel
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

    if img is None:
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
    gray = _to_black_on_white(gray)

    if os.environ.get("OCR_DEBUG_GAMECODE", "0") == "1":
        try:
            cv2.imwrite("gamecode_roi.png", crop)
        except Exception:
            pass

    config = f"--psm {int(config_obj.full_psm)} -c tessedit_char_whitelist={config_obj.full_whitelist}"

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
        value = _normalize_twister_gamecode(normalized) or _extract_gamecode(normalized)
        if value:
            refined_value, refined_text = _refine_digits_only(
                bin_img,
                value,
                normalized,
                refine_psm=config_obj.refine_psm,
                whitelist=config_obj.refine_whitelist,
            )
            valid_candidates.append(_Candidate(name=name, value=refined_value, raw_text=refined_text))

    try:
        gray_txt = pytesseract.image_to_string(gray, config=config)
    except Exception:
        gray_txt = ""

    gray_normalized = _normalize_text(gray_txt)
    raw_candidates.append(gray_normalized)
    value = _normalize_twister_gamecode(gray_normalized) or _extract_gamecode(gray_normalized)
    if value:
        refined_value, refined_text = _refine_digits_only(
            gray,
            value,
            gray_normalized,
            refine_psm=config_obj.refine_psm,
            whitelist=config_obj.refine_whitelist,
        )
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


def read_gamecode(
    image_path: str,
    x1: int = 0,
    y1: int = 0,
    roi_rel: Tuple[int, int, int, int] = ROI_DEFAULT,
    *,
    full_psm: int = 8,
    refine_psm: int = 8,
    img: Optional["np.ndarray"] = None,
) -> Dict[str, Any]:
    """Fast gamecode reader: single threshold + scale, ~0.3s."""
    dx, dy, w, h = roi_rel
    ax, ay = int(x1 + dx), int(y1 + dy)
    roi_abs = (ax, ay, int(w), int(h))

    if cv2 is None or np is None or pytesseract is None:
        return {"ok": False, "value": None, "raw_text": "", "roi": roi_abs, "error": "deps_missing"}

    if img is None:
        if not image_path or not os.path.exists(image_path):
            return {"ok": False, "value": None, "raw_text": "", "roi": roi_abs, "error": "image_not_found"}
        img = cv2.imread(image_path)
    if img is None:
        return {"ok": False, "value": None, "raw_text": "", "roi": roi_abs, "error": "cv2_imread_failed"}

    crop = _safe_crop(img, ax, ay, w, h)
    if crop is None:
        return {"ok": False, "value": None, "raw_text": "", "roi": roi_abs, "error": "roi_out_of_bounds"}

    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY) if len(crop.shape) == 3 else crop
    scaled = cv2.resize(gray, (w * 4, h * 4), interpolation=cv2.INTER_CUBIC)
    _, binary = cv2.threshold(scaled, 140, 255, cv2.THRESH_BINARY)

    try:
        text = pytesseract.image_to_string(binary, config="--psm 7 -c tessedit_char_whitelist=0123456789").strip()
    except Exception as e:
        return {"ok": False, "value": None, "raw_text": "", "roi": roi_abs, "error": f"tesseract:{e}"}

    digits = re.sub(r"\D+", "", text)
    value = _normalize_twister_gamecode(digits)
    if value:
        return {"ok": True, "value": value, "raw_text": digits, "roi": roi_abs}
    return {"ok": False, "value": None, "raw_text": digits, "roi": roi_abs, "error": "gamecode_not_found"}


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
