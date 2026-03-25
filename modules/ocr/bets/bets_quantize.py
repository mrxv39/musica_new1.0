# C:\Users\Usuario\Desktop\proyectos\poker_boss\modules\ocr\bets\bets_quantize.py
from __future__ import annotations

# Max reasonable bet in BB — any bet above this is likely a decimal read error
MAX_BET_BB = 75.0


def is_decimal_like(cleaned: str) -> bool:
    return ("." in cleaned) or ("," in cleaned) or (len(cleaned) >= 3 and cleaned.startswith("0"))


def quantize_bet(label: str, v: float) -> float:
    """
    Snap rápido para que strategy matchee.
    Ajusta solo rangos típicos (evita cambiar valores grandes).
    Also applies sanity check: if bet > MAX_BET_BB, try decimal shift.
    """
    if v <= 0.0:
        return 0.0

    # Tight snap a 0.5 y 1.0 (caso actual: 0.57 -> 0.5)
    if 0.42 <= v <= 0.58:
        return 0.5
    if 0.92 <= v <= 1.08:
        return 1.0

    # Sanity check: bet > 75bb is almost certainly a missing decimal point
    # e.g. 94 -> 9.4, 127 -> 12.7
    if v > MAX_BET_BB:
        shifted = v / 10.0
        if 0.1 <= shifted <= MAX_BET_BB:
            return float(shifted)

    return float(v)


def looks_like_wrong_integer_for_half(label: str, v: float, raw: str) -> bool:
    """
    Heurística: detecta cuándo disparar fallback adaptativo.
    - p2: raw no contiene decimal y valor parece entero >= 2 (podría ser 0.5 mal leído)
    - p1: raw no contiene decimal y valor parece 2 o 3
    - p1/p3: valor > MAX_BET_BB (probablemente falta punto decimal)
    - p3: raw no contiene decimal y valor es entero "redondo" que no matchea
           ningún bet típico (podría ser lectura truncada, ej. 27 en vez de 22.37)
    """
    t = (raw or "").strip()
    has_decimal = "." in t or "," in t

    # Any label: value too high → needs re-read with adaptive
    if v > MAX_BET_BB:
        return True

    if has_decimal:
        return False

    try:
        iv = int(float(v))
    except Exception:
        return False
    if label == "p2":
        return iv >= 2
    if label == "p1":
        return iv in (2, 3)
    # p3: only retry if value is impossibly high (likely missing decimal)
    if label == "p3":
        return v > MAX_BET_BB
    return False
