# C:\Users\Usuario\Desktop\proyectos\poker_boss\modules\ocr\bets\bets_variants.py
from __future__ import annotations

from typing import Iterator, Tuple
import cv2
import numpy as np


def maybe_upscale(gray: np.ndarray) -> np.ndarray:
    h, w = gray.shape[:2]
    if w < 45 or h < 18:
        return cv2.resize(gray, (w * 3, h * 3), interpolation=cv2.INTER_CUBIC)
    return gray


def iter_variants_limited(gray_crop: np.ndarray, label: str) -> Iterator[Tuple[str, np.ndarray]]:
    """
    Variantes mínimas para velocidad.
    - p1/p3: 2 calls (thr200, otsu)
    - p2: 4 calls (thr200, otsu, thr200_inv, otsu_inv)
    """
    g = maybe_upscale(gray_crop)
    g = cv2.medianBlur(g, 3)

    _, thr200 = cv2.threshold(g, 200, 255, cv2.THRESH_BINARY)
    _, otsu = cv2.threshold(g, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

    if label == "p2":
        yield "thr200", thr200
        yield "otsu", otsu
        yield "thr200_inv", cv2.bitwise_not(thr200)
        yield "otsu_inv", cv2.bitwise_not(otsu)
    else:
        yield "thr200", thr200
        yield "otsu", otsu


def iter_variants_adaptive(gray_crop: np.ndarray, label: str) -> Iterator[Tuple[str, np.ndarray]]:
    """
    Fallback caro: usar SOLO cuando sea imprescindible.
    """
    g = maybe_upscale(gray_crop)
    g = cv2.medianBlur(g, 3)

    adapt = cv2.adaptiveThreshold(
        g, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 11, 2
    )
    yield "adaptive", adapt
    yield "adaptive_inv", cv2.bitwise_not(adapt)
    if label == "p1":
        # Variante extra para p1: más escala y threshold más suave para intentar preservar el decimal de "0.5".
        g_p1 = cv2.resize(gray_crop, None, fx=5, fy=5, interpolation=cv2.INTER_CUBIC)
        g_p1 = cv2.GaussianBlur(g_p1, (3, 3), 0)
        _, thr180 = cv2.threshold(g_p1, 180, 255, cv2.THRESH_BINARY)
        yield "p1_decimal_thr180", thr180
        yield "p1_decimal_thr180_inv", cv2.bitwise_not(thr180)
