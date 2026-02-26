# C:\Users\Usuario\Desktop\proyectos\poker_boss\modules\ocr\bets\bets_parse.py
# Parsing + cleaning for bets OCR.

from __future__ import annotations

import re
from typing import Optional

from .bets_models import _FLOAT_RE


def parse_float(text: str) -> Optional[float]:
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


def clean_numeric_text(text: str) -> str:
    t = re.sub(r"[^0-9.]", "", text or "")
    t = re.sub(r"\.{2,}", ".", t)
    if t.count(".") > 1:
        first = t.find(".")
        t = t[: first + 1] + t[first + 1 :].replace(".", "")
    return t.strip()


def score_candidate(cleaned: str, val: Optional[float]) -> int:
    return len(cleaned) + (2 if "." in cleaned else 0) + (5 if val is not None else 0)


def is_confident(cleaned: str, val: Optional[float]) -> bool:
    # Corte temprano más agresivo para velocidad
    if val is None:
        return False
    digits = cleaned.replace(".", "")
    if len(digits) < 1:
        return False
    # con 0.5 / 1 / 12 / 2.5 ya vale
    return len(cleaned) >= 1
