# C:\Users\Usuario\Desktop\proyectos\poker_boss\modules\ocr\bets\bets_ocr_core.py
from __future__ import annotations

import os
from typing import Optional, Tuple

import cv2
import numpy as np

try:
    import pytesseract
except Exception:  # pragma: no cover
    pytesseract = None  # type: ignore

from .bets_models import BetOCRResult, TesseractConfig
from .bets_parse import clean_numeric_text, parse_float, score_candidate
from .bets_utils import safe_crop, debug_save_crop
from .bets_cache import get_cached, set_cached
from .bets_variants import iter_variants_limited, iter_variants_adaptive
from .bets_quantize import is_decimal_like, quantize_bet, looks_like_wrong_integer_for_half


def bets_debug_enabled() -> bool:
    return os.environ.get("OCR_DEBUG_BETS", "0") == "1"


def tesseract_available() -> bool:
    return pytesseract is not None


def tesseract_ocr(bin_img: np.ndarray, cfg: TesseractConfig) -> Optional[str]:
    if pytesseract is None:
        return None
    try:
        return pytesseract.image_to_string(bin_img, config=cfg.config)
    except Exception:
        return None


def roi_fingerprint(gray_crop: np.ndarray) -> int:
    """
    Fingerprint MUY barato:
    - resize 32x16
    - blur
    - otsu
    - packbits+hash
    """
    g = gray_crop
    if g is None or g.size == 0:
        return 0
    g = cv2.resize(g, (32, 16), interpolation=cv2.INTER_AREA)
    g = cv2.GaussianBlur(g, (3, 3), 0)
    _, b = cv2.threshold(g, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    bits = (b > 0).astype(np.uint8)
    packed = np.packbits(bits, axis=None)
    return hash(packed.tobytes())


def normalize_final_result(best: BetOCRResult) -> BetOCRResult:
    if best.ok:
        return best
    if (best.raw_text or "").strip() == "":
        return BetOCRResult(ok=True, value=0.0, raw_text="", roi=best.roi, method=best.method, error="")
    return BetOCRResult(
        ok=False,
        value=0.0,
        raw_text=best.raw_text,
        roi=best.roi,
        method=best.method,
        error=best.error or "parse_failed",
    )


def ocr_roi(
    img_gray: np.ndarray,
    roi: Tuple[int, int, int, int],
    label: str,
    cfg: TesseractConfig,
) -> BetOCRResult:
    x, y, w, h = roi
    crop = safe_crop(img_gray, x, y, w, h)
    if crop is None:
        return BetOCRResult(ok=False, value=0.0, raw_text="", roi=roi, method="failed", error="roi_out_of_bounds")

    debug_save_crop(crop, label)

    fp = roi_fingerprint(crop)
    cached = get_cached(label, fp)
    if cached is not None:
        v, raw, method, ok = cached
        return BetOCRResult(ok=ok, value=float(v), raw_text=raw, roi=roi, method=method, error="")

    if not tesseract_available():
        res = BetOCRResult(ok=False, value=0.0, raw_text="", roi=roi, method="none", error="pytesseract_not_available")
        set_cached(label, fp, res.value, res.raw_text, res.method, res.ok)
        return res

    best: Optional[BetOCRResult] = None
    best_score = -1

    # Pass 1: limited variants
    for method, bin_img in iter_variants_limited(crop, label):
        txt = tesseract_ocr(bin_img, cfg)
        if txt is None:
            continue

        cleaned = clean_numeric_text(txt).replace(",", ".")
        val = parse_float(cleaned)

        sc = score_candidate(cleaned, val)
        if label == "p2" and is_decimal_like(cleaned) and val is not None:
            sc += 10

        cand = BetOCRResult(
            ok=val is not None,
            value=float(val) if val is not None else 0.0,
            raw_text=cleaned,
            roi=roi,
            method=method,
            error="" if val is not None else "parse_failed",
        )

        if best is None or sc > best_score:
            best = cand
            best_score = sc

        if val is not None:
            if label == "p2":
                if is_decimal_like(cleaned):
                    break
            else:
                break

    if best is None:
        res = BetOCRResult(ok=False, value=0.0, raw_text="", roi=roi, method="failed", error="ocr_failed")
        set_cached(label, fp, res.value, res.raw_text, res.method, res.ok)
        return res

    best = normalize_final_result(best)

    # Pass 2: fallback adaptive si la heurística detecta entero erróneo para medio blind.
    run_adaptive = best.ok and looks_like_wrong_integer_for_half(label, best.value, best.raw_text)
    if bets_debug_enabled():
        print(
            f"DEBUG bets label={label} value={best.value} raw={best.raw_text!r} run_adaptive={run_adaptive}"
        )
    if run_adaptive:
        for method, bin_img in iter_variants_adaptive(crop, label):
            txt = tesseract_ocr(bin_img, cfg)
            if txt is None:
                continue
            cleaned = clean_numeric_text(txt).replace(",", ".")
            val = parse_float(cleaned)
            if bets_debug_enabled() and val is not None:
                print(f"DEBUG adaptive label={label} candidate_value={val} cleaned={cleaned!r}")

            sc = score_candidate(cleaned, val)
            if is_decimal_like(cleaned) and val is not None:
                sc += 10

            cand = BetOCRResult(
                ok=val is not None,
                value=float(val) if val is not None else 0.0,
                raw_text=cleaned,
                roi=roi,
                method=method,
                error="" if val is not None else "parse_failed",
            )

            if cand.ok and is_decimal_like(cleaned):
                best = cand
                break
            if sc > best_score:
                best = cand
                best_score = sc

        best = normalize_final_result(best)

    # Quantize final
    if best.ok:
        qv = quantize_bet(label, best.value)
        if qv != best.value:
            best = BetOCRResult(ok=True, value=qv, raw_text=best.raw_text, roi=best.roi, method=best.method, error="")

    set_cached(label, fp, best.value, best.raw_text, best.method, best.ok)
    return best
