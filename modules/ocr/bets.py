# C:\Users\Usuario\Desktop\proyectos\poker_boss\modules\ocr\bets.py
# OCR bets (numeros) en 3 ROIs relativos (p1/p2/p3), con robustez tipo stackefectivo.

from __future__ import annotations

import os
import re
import time
from dataclasses import dataclass
from typing import Dict, Tuple, Optional, Any

import cv2
import numpy as np

try:
    import pytesseract
except Exception:  # pragma: no cover
    pytesseract = None  # type: ignore


ROI_P1BET_DEFAULT: Tuple[int, int, int, int] = (388, 378, 50, 20)
ROI_P2BET_DEFAULT: Tuple[int, int, int, int] = (160, 220, 55, 20)
ROI_P3BET_DEFAULT: Tuple[int, int, int, int] = (565, 220, 50, 20)


@dataclass(frozen=True)
class BetOCRResult:
    ok: bool
    value: float
    raw_text: str
    roi: Tuple[int, int, int, int]
    method: str
    error: str = ""


_FLOAT_RE = re.compile(r"(\d+(?:[.,]\d+)?)")


def _now_ms() -> int:
    return int(time.time() * 1000)


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


def _parse_float(text: str) -> Optional[float]:
    if not text:
        return None
    t = text.strip().replace(" ", "").replace(",", ".")
    m = _FLOAT_RE.search(t)
    if not m:
        return None
    try:
        return float(m.group(1))
    except Exception:
        return None


def _clean_numeric_text(text: str) -> str:
    # deja solo dígitos y puntos
    t = re.sub(r"[^0-9.]", "", text or "")
    # colapsar múltiples puntos seguidos
    t = re.sub(r"\.{2,}", ".", t)
    # si hay más de un punto, dejar solo el primero
    if t.count(".") > 1:
        first = t.find(".")
        t = t[: first + 1] + t[first + 1 :].replace(".", "")
    return t.strip()


def _preprocess_variants(gray: np.ndarray) -> Dict[str, np.ndarray]:
    """
    Genera variantes para OCR. Nos interesa también invertir, porque en bets
    a veces funciona mejor el contraste invertido.
    """
    variants: Dict[str, np.ndarray] = {}

    # upscale x3 (mejora tesseract en números pequeños)
    h, w = gray.shape[:2]
    up = cv2.resize(gray, (w * 3, h * 3), interpolation=cv2.INTER_CUBIC)
    up = cv2.medianBlur(up, 3)

    # Fixed threshold alto (legacy ~200)
    _, thr = cv2.threshold(up, 200, 255, cv2.THRESH_BINARY)
    variants["thr200"] = thr

    _, thr_inv = cv2.threshold(up, 200, 255, cv2.THRESH_BINARY_INV)
    variants["thr200_inv"] = thr_inv

    # Otsu + inv
    _, otsu = cv2.threshold(up, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    variants["otsu"] = otsu
    variants["otsu_inv"] = cv2.bitwise_not(otsu)

    # Adaptive + inv
    adapt = cv2.adaptiveThreshold(
        up, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 11, 2
    )
    variants["adaptive"] = adapt
    variants["adaptive_inv"] = cv2.bitwise_not(adapt)

    # Morfología ligera (abre) para limpiar ruido
    kernel = np.ones((2, 2), np.uint8)
    for k, v in list(variants.items()):
        opened = cv2.morphologyEx(v, cv2.MORPH_OPEN, kernel, iterations=1)
        variants[f"{k}_open"] = opened

    return variants


def _ocr_one_roi(
    img_gray: np.ndarray,
    x: int,
    y: int,
    w: int,
    h: int,
    label: str,
) -> BetOCRResult:
    crop = _safe_crop(img_gray, x, y, w, h)
    if crop is None:
        return BetOCRResult(
            ok=False,
            value=0.0,
            raw_text="",
            roi=(x, y, w, h),
            method="failed",
            error="roi_out_of_bounds",
        )

    # Debug legacy: guardar crop GRIS (no binarizado), como pedías
    if os.environ.get("OCR_DEBUG_BETS", "0") == "1":
        try:
            os.makedirs("preflop/crops", exist_ok=True)
            cv2.imwrite(os.path.join("preflop/crops", f"{label}bet_roi.png"), crop)
        except Exception:
            pass

    if pytesseract is None:
        return BetOCRResult(
            ok=False,
            value=0.0,
            raw_text="",
            roi=(x, y, w, h),
            method="none",
            error="pytesseract_not_available",
        )

    config = "--psm 7 -c tessedit_char_whitelist=0123456789."

    best: Optional[BetOCRResult] = None
    best_score = -1

    variants = _preprocess_variants(crop)
    for method, bin_img in variants.items():
        try:
            txt = pytesseract.image_to_string(bin_img, config=config)
        except Exception:
            continue

        cleaned = _clean_numeric_text(txt)
        val = _parse_float(cleaned)

        # score simple: +len, +bonus si contiene punto, +bonus si val parsea
        score = len(cleaned) + (2 if "." in cleaned else 0) + (5 if val is not None else 0)

        candidate = BetOCRResult(
            ok=val is not None,
            value=float(val) if val is not None else 0.0,
            raw_text=cleaned,
            roi=(x, y, w, h),
            method=method,
            error="" if val is not None else "parse_failed",
        )

        if best is None or score > best_score:
            best = candidate
            best_score = score

    if best is None:
        return BetOCRResult(
            ok=False,
            value=0.0,
            raw_text="",
            roi=(x, y, w, h),
            method="failed",
            error="ocr_failed",
        )

    # REGLA: raw vacío => bet 0.0 y NO error (ok=True)
    if not best.ok:
        if (best.raw_text or "").strip() == "":
            return BetOCRResult(
                ok=True,
                value=0.0,
                raw_text="",
                roi=best.roi,
                method=best.method,
                error="",
            )

        # raw no vacío y no parsea => error real
        return BetOCRResult(
            ok=False,
            value=0.0,
            raw_text=best.raw_text,
            roi=best.roi,
            method=best.method,
            error=best.error or "parse_failed",
        )

    return best


def read_bets(
    image_path: str,
    x1: int = 0,
    y1: int = 0,
    roi_p1: Tuple[int, int, int, int] = ROI_P1BET_DEFAULT,
    roi_p2: Tuple[int, int, int, int] = ROI_P2BET_DEFAULT,
    roi_p3: Tuple[int, int, int, int] = ROI_P3BET_DEFAULT,
) -> Dict[str, Any]:
    """
    Lee bets de 3 jugadores desde una captura.
    Regla OK (opción 1):
      - ok=True si al menos 1 ROI se ha parseado correctamente.
      - si una ROI falla -> value=0.0 y error en errors[].

    Returns:
      {
        "ok": bool,
        "p1": float, "p2": float, "p3": float,
        "raw": {"p1": str, "p2": str, "p3": str},
        "roi": {"p1": [x,y,w,h], ...},
        "method": {"p1": str, ...},
        "errors": [ "p1:roi_out_of_bounds", "p2:parse_failed", ... ],
        "ts_ms": int
      }
    """
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
        "ts_ms": _now_ms(),
    }

    if not image_path or not os.path.exists(image_path):
        out["errors"].append("image_not_found")
        return out

    img = cv2.imread(image_path, cv2.IMREAD_GRAYSCALE)
    if img is None:
        out["errors"].append("imread_fail")
        return out

    # Procesar 3 ROIs
    results: Dict[str, BetOCRResult] = {}
    for key in ("p1", "p2", "p3"):
        rx, ry, rw, rh = out["roi"][key]
        results[key] = _ocr_one_roi(img, rx, ry, rw, rh, label=key)

        out[key] = results[key].value
        out["raw"][key] = results[key].raw_text
        out["method"][key] = results[key].method
        if not results[key].ok:
            out["errors"].append(f"{key}:{results[key].error}")

    # OK si al menos una ROI fue ok
    out["ok"] = any(r.ok for r in results.values())
    return out


if __name__ == "__main__":
    import sys, json

    image_path = None
    if "--image" in sys.argv:
        try:
            image_path = sys.argv[sys.argv.index("--image") + 1]
        except Exception:
            image_path = None

    res = read_bets(image_path) if image_path else {"ok": False, "errors": ["no_image"]}
    print(json.dumps(res, ensure_ascii=False))
