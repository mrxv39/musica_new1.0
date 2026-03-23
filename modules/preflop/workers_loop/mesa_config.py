# C:\Users\Usuario\Desktop\proyectos\poker_boss\modules\preflop\workers_loop\mesa_config.py
from __future__ import annotations

from typing import Dict, Tuple

from .config import AREAS

TIME_ROI_REL = (350, 470, 50, 15)


def get_area_by_mesa(mesa: int) -> Dict:
    for area in AREAS:
        if int(area["mesa"]) == int(mesa):
            return area
    raise ValueError(f"mesa_not_found:{mesa}")


def build_time_bbox(area: Dict) -> Tuple[int, int, int, int]:
    x, y, w, h = TIME_ROI_REL
    x1 = int(area["x1"]) + x
    y1 = int(area["y1"]) + y
    x2 = x1 + w
    y2 = y1 + h
    return (x1, y1, x2, y2)

