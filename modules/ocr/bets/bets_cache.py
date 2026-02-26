# C:\Users\Usuario\Desktop\proyectos\poker_boss\modules\ocr\bets\bets_cache.py
from __future__ import annotations

from typing import Dict, Tuple, Optional

# key: "p1"|"p2"|"p3" -> (fp:int, value:float, raw:str, method:str, ok:bool)
_ROI_CACHE: Dict[str, Tuple[int, float, str, str, bool]] = {}


def get_cached(label: str, fp: int) -> Optional[Tuple[float, str, str, bool]]:
    c = _ROI_CACHE.get(label)
    if c is None:
        return None
    if c[0] != fp:
        return None
    _, v, raw, method, ok = c
    return (v, raw, method, ok)


def set_cached(label: str, fp: int, value: float, raw: str, method: str, ok: bool) -> None:
    _ROI_CACHE[label] = (fp, float(value), raw or "", method or "", bool(ok))


def clear_cache() -> None:
    _ROI_CACHE.clear()
