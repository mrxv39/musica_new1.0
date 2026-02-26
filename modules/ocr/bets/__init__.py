# C:\Users\Usuario\Desktop\proyectos\poker_boss\modules\ocr\bets\__init__.py
# Compat tests: algunos tests parchean atributos en `modules.ocr.bets` (nivel paquete):
# - cv2
# - pytesseract
# Por eso re-exportamos aquí.

from __future__ import annotations

import numpy as np  # noqa: F401
import cv2  # noqa: F401

try:
    import pytesseract  # noqa: F401
except Exception:  # pragma: no cover
    pytesseract = None  # type: ignore

from .bets import read_bets

__all__ = ["read_bets", "cv2", "np", "pytesseract"]
