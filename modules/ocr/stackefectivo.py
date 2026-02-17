# C:\Users\Usuario\Desktop\proyectos\musica_new\modules\ocr\stackefectivo.py
# OCR stack efectivo (numeros) en ROI relativo.
# Basado en encontrar_stackefectivo.py (legacy) pero con mejoras de robustez.

from __future__ import annotations

import os
import re
from dataclasses import dataclass
from typing import Dict, Tuple, Optional, Any

import cv2
import numpy as np

try:
    import pytesseract
except Exception:  # pragma: no cover
    pytesseract = None  # type: ignore


ROI_REL_DEFAULT: Tuple[int, int, int, int] = (265, 472, 72, 42)  # dx,dy,w,h


@dataclass(frozen=True)
class StackOCRResult:
    ok: bool
    value: float
    raw_text: str
    roi: Tuple[int, int, int, int]
    method: str
    error: str = ""


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


def _preprocess_variants(gray: np.ndarray) -> Dict[str, np.ndarray]:
    """
    Devuelve varias binarizaciones para probar OCR.
    """
    variants: Dict[str, np.ndarray] = {}

    # Denoise suave
    den = cv2.medianBlur(gray, 3)

    # 1) legacy fixed threshold
    _, thr_fixed = cv2.threshold(den, 100, 255, cv2.THRESH_BINARY)
    variants["fixed_100"] = thr_fixed

    # 2) Otsu
    _, thr_otsu = cv2.threshold(den, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    variants["otsu"] = thr_otsu

    # 3) Adaptive
    thr_adapt = cv2.adaptiveThreshold(
        den, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 11, 2
    )
    variants["adaptive"] = thr_adapt

    # Morfología ligera para limpiar puntos
    kernel = np.ones((2, 2), np.uint8)
    for k, v in list(variants.items()):
        opened = cv2.morphologyEx(v, cv2.MORPH_OPEN, kernel, iterations=1)
        variants[f"{k}_open"] = opened

    return variants


_FLOAT_RE = re.compile(r"(\d+(?:[.,]\d+)?)")


def _parse_float(text: str) -> Optional[float]:
    if not text:
        return None
    text = text.strip()
    text = text.replace(" ", "")
    text = text.replace(",", ".")
    m = _FLOAT_RE.search(text)
    if not m:
        return None
    try:
        return float(m.group(1))
    except Exception:
        return None


def read_stack_efectivo(
    image_path: str,
    x1: int = 0,
    y1: int = 0,
    roi_rel: Tuple[int, int, int, int] = ROI_REL_DEFAULT,
    *,
    tesseract_psm: int = 7,
) -> Dict[str, Any]:
    """
    Lee el stack efectivo (número) en una región ROI relativa dentro de una captura.

    Args:
        image_path: ruta a imagen.
        x1,y1: offset absoluto (si la imagen viene de un recorte mayor).
        roi_rel: (dx,dy,w,h) relativo.
        tesseract_psm: psm de tesseract (default 7 = línea única).

    Returns:
        dict:
        {
          "ok": bool,
          "value": float,
          "raw_text": str,
          "roi": [x,y,w,h],
          "method": str,
          "error": str
        }
    """
    dx, dy, w, h = roi_rel
    x = int(x1 + dx)
    y = int(y1 + dy)

    if pytesseract is None:
        return StackOCRResult(
            ok=False,
            value=0.0,
            raw_text="",
            roi=(x, y, w, h),
            method="none",
            error="pytesseract_not_available",
        ).__dict__

    if not image_path or not os.path.exists(image_path):
        return StackOCRResult(
            ok=False,
            value=0.0,
            raw_text="",
            roi=(x, y, w, h),
            method="none",
            error="image_not_found",
        ).__dict__

    img = cv2.imread(image_path)
    if img is None:
        return StackOCRResult(
            ok=False,
            value=0.0,
            raw_text="",
            roi=(x, y, w, h),
            method="none",
            error="cv2_imread_failed",
        ).__dict__

    crop = _safe_crop(img, x, y, w, h)
    if crop is None:
        return StackOCRResult(
            ok=False,
            value=0.0,
            raw_text="",
            roi=(x, y, w, h),
            method="none",
            error="roi_out_of_bounds",
        ).__dict__

    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)

    # Debug crop (como el legacy)
    if os.environ.get("OCR_DEBUG_STACK", "0") == "1":
        try:
            cv2.imwrite("stackefectivo_roi.png", crop)
        except Exception:
            pass

    # Probar varias variantes y quedarse con la primera que parsea float
    config = f"--psm {int(tesseract_psm)} -c tessedit_char_whitelist=0123456789."

    variants = _preprocess_variants(gray)
    for method, bin_img in variants.items():
        try:
            txt = pytesseract.image_to_string(bin_img, config=config).strip()
        except Exception:
            continue

        val = _parse_float(txt)
        if val is not None:
            return StackOCRResult(
                ok=True,
                value=float(val),
                raw_text=txt,
                roi=(x, y, w, h),
                method=method,
            ).__dict__

    # Último intento: OCR en gris (sin binarizar)
    try:
        txt_gray = pytesseract.image_to_string(gray, config=config).strip()
    except Exception:
        txt_gray = ""

    val_gray = _parse_float(txt_gray)
    if val_gray is not None:
        return StackOCRResult(
            ok=True,
            value=float(val_gray),
            raw_text=txt_gray,
            roi=(x, y, w, h),
            method="gray",
        ).__dict__

    return StackOCRResult(
        ok=False,
        value=0.0,
        raw_text=txt_gray,
        roi=(x, y, w, h),
        method="failed",
        error="parse_failed",
    ).__dict__
