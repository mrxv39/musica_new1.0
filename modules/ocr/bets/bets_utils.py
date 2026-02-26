# C:\Users\Usuario\Desktop\proyectos\poker_boss\modules\ocr\bets\bets_utils.py

from __future__ import annotations

import os
import time
from typing import Optional, Tuple

import cv2
import numpy as np

from .bets_models import BetsROIs


def now_ms() -> int:
    return int(time.time() * 1000)


def safe_crop(img: np.ndarray, x: int, y: int, w: int, h: int) -> Optional[np.ndarray]:
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


def load_gray_image(image_path: str) -> Tuple[Optional[np.ndarray], Optional[str]]:
    if not image_path or not os.path.exists(image_path):
        return None, "image_not_found"
    img = cv2.imread(image_path, cv2.IMREAD_GRAYSCALE)
    if img is None:
        return None, "imread_fail"
    return img, None


def build_rois(
    x1: int,
    y1: int,
    roi_p1: Tuple[int, int, int, int],
    roi_p2: Tuple[int, int, int, int],
    roi_p3: Tuple[int, int, int, int],
) -> BetsROIs:
    def _abs_roi(r: Tuple[int, int, int, int]) -> Tuple[int, int, int, int]:
        return (int(x1 + r[0]), int(y1 + r[1]), int(r[2]), int(r[3]))

    return BetsROIs(
        p1=_abs_roi(roi_p1),
        p2=_abs_roi(roi_p2),
        p3=_abs_roi(roi_p3),
    )


def debug_save_crop(gray_crop: np.ndarray, label: str) -> None:
    if os.environ.get("OCR_DEBUG_BETS", "0") != "1":
        return
    try:
        os.makedirs("preflop/crops", exist_ok=True)
        cv2.imwrite(os.path.join("preflop/crops", f"{label}bet_roi.png"), gray_crop)
    except Exception:
        pass
