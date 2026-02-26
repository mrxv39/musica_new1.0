# C:\Users\Usuario\Desktop\proyectos\poker_boss\modules\ocr\bets\bets_preprocess.py
# Minimal fast preprocess for bets OCR (aggressive speed).

from __future__ import annotations

from typing import Iterable, Tuple

import cv2
import numpy as np


def _maybe_upscale(gray: np.ndarray) -> np.ndarray:
    # ROI bets suele ser pequeño; upscale x3 es caro y muchas veces no aporta.
    # Solo upscale si el ROI es MUY pequeño.
    h, w = gray.shape[:2]
    if w < 45 or h < 18:
        return cv2.resize(gray, (w * 3, h * 3), interpolation=cv2.INTER_CUBIC)
    return gray


def iter_variants(gray_crop: np.ndarray) -> Iterable[Tuple[str, np.ndarray]]:
    """
    Variantes mínimas y ordenadas para éxito temprano.
    Máximo 4 (2 principales + sus invertidas).
    """
    g = _maybe_upscale(gray_crop)

    # Un blur ligero ayuda a limpiar speckle
    g = cv2.medianBlur(g, 3)

    # 1) Fixed threshold (legacy)
    _, thr200 = cv2.threshold(g, 200, 255, cv2.THRESH_BINARY)
    yield "thr200", thr200

    # 2) Otsu
    _, otsu = cv2.threshold(g, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    yield "otsu", otsu

    # 3) Invertidas (a veces mejor)
    yield "thr200_inv", cv2.bitwise_not(thr200)
    yield "otsu_inv", cv2.bitwise_not(otsu)
