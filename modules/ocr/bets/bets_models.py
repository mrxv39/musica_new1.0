# C:\Users\Usuario\Desktop\proyectos\poker_boss\modules\ocr\bets\bets_models.py

from __future__ import annotations
import re
from dataclasses import dataclass
from typing import Tuple, Iterable

ROI_P1BET_DEFAULT: Tuple[int, int, int, int] = (388, 378, 50, 20)
ROI_P2BET_DEFAULT: Tuple[int, int, int, int] = (160, 220, 55, 20)
ROI_P3BET_DEFAULT: Tuple[int, int, int, int] = (565, 220, 50, 20)

_FLOAT_RE = re.compile(r"(\d+(?:[.,]\d+)?)")

@dataclass(frozen=True)
class BetOCRResult:
    ok: bool
    value: float
    raw_text: str
    roi: Tuple[int, int, int, int]
    method: str
    error: str = ""

@dataclass(frozen=True)
class BetsROIs:
    p1: Tuple[int, int, int, int]
    p2: Tuple[int, int, int, int]
    p3: Tuple[int, int, int, int]

    def items(self) -> Iterable[Tuple[str, Tuple[int, int, int, int]]]:
        return (("p1", self.p1), ("p2", self.p2), ("p3", self.p3))

@dataclass(frozen=True)
class TesseractConfig:
    config: str = "--psm 7 -c tessedit_char_whitelist=0123456789\.,"

