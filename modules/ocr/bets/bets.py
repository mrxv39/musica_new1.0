# C:\Users\Usuario\Desktop\proyectos\poker_boss\modules\ocr\bets\bets.py
# Wrapper: read_bets usa core OCR dividido en módulos pequeños.
# Compat: tests parchean `modules.ocr.bets.cv2` (legacy), así que re-exportamos cv2/np aquí.

from __future__ import annotations

from typing import Dict, Tuple, Any

import numpy as np  # noqa: F401
import cv2  # noqa: F401

from .bets_models import (
    ROI_P1BET_DEFAULT,
    ROI_P2BET_DEFAULT,
    ROI_P3BET_DEFAULT,
    BetOCRResult,
    TesseractConfig,
)
from .bets_utils import now_ms, load_gray_image, build_rois
from .bets_ocr_core import ocr_roi


def read_bets(
    image_path: str,
    x1: int = 0,
    y1: int = 0,
    roi_p1: Tuple[int, int, int, int] = ROI_P1BET_DEFAULT,
    roi_p2: Tuple[int, int, int, int] = ROI_P2BET_DEFAULT,
    roi_p3: Tuple[int, int, int, int] = ROI_P3BET_DEFAULT,
) -> Dict[str, Any]:
    rois = build_rois(x1, y1, roi_p1, roi_p2, roi_p3)

    out: Dict[str, Any] = {
        "ok": False,
        "p1": 0.0,
        "p2": 0.0,
        "p3": 0.0,
        "raw": {"p1": "", "p2": "", "p3": ""},
        "roi": {
            "p1": [rois.p1[0], rois.p1[1], rois.p1[2], rois.p1[3]],
            "p2": [rois.p2[0], rois.p2[1], rois.p2[2], rois.p2[3]],
            "p3": [rois.p3[0], rois.p3[1], rois.p3[2], rois.p3[3]],
        },
        "method": {"p1": "", "p2": "", "p3": ""},
        "errors": [],
        "ts_ms": now_ms(),
    }

    img, err = load_gray_image(image_path)
    if err is not None:
        out["errors"].append(err)
        return out
    assert img is not None

    cfg = TesseractConfig()
    results: Dict[str, BetOCRResult] = {}

    for key, roi in rois.items():
        res = ocr_roi(img, roi, label=key, cfg=cfg)
        results[key] = res
        out[key] = res.value
        out["raw"][key] = res.raw_text
        out["method"][key] = res.method
        if not res.ok:
            out["errors"].append(f"{key}:{res.error}")

    out["ok"] = any(r.ok for r in results.values())
    return out


if __name__ == "__main__":
    import sys
    import json

    image_path = None
    if "--image" in sys.argv:
        try:
            image_path = sys.argv[sys.argv.index("--image") + 1]
        except Exception:
            image_path = None

    res = read_bets(image_path) if image_path else {"ok": False, "errors": ["no_image"]}
    print(json.dumps(res, ensure_ascii=False))
