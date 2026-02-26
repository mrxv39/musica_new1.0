# C:\Users\Usuario\Desktop\proyectos\poker_boss\modules\ocr\bets\bets_quantize.py
from __future__ import annotations


def is_decimal_like(cleaned: str) -> bool:
    return ("." in cleaned) or ("," in cleaned) or (len(cleaned) >= 3 and cleaned.startswith("0"))


def quantize_bet(label: str, v: float) -> float:
    """
    Snap rápido para que strategy matchee.
    Ajusta solo rangos típicos (evita cambiar valores grandes).
    """
    if v <= 0.0:
        return 0.0

    # Tight snap a 0.5 y 1.0 (caso actual: 0.57 -> 0.5)
    if 0.42 <= v <= 0.58:
        return 0.5
    if 0.92 <= v <= 1.08:
        return 1.0

    return float(v)


def looks_like_wrong_integer_for_half(label: str, v: float, raw: str) -> bool:
    """
    Heurística: p2 a veces lee "2" cuando era "0.5".
    Disparar fallback solo si:
    - label == p2
    - raw no contiene decimal
    - y valor parece entero >= 2
    """
    if label != "p2":
        return False
    t = (raw or "").strip()
    if "." in t or "," in t:
        return False
    try:
        iv = int(float(v))
    except Exception:
        return False
    return iv >= 2
