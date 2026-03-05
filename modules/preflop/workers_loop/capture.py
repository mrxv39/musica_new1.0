# C:\Users\Usuario\Desktop\proyectos\poker_boss\modules\preflop\workers_loop\capture.py
from __future__ import annotations

import os
from typing import Dict

from PIL import ImageGrab


def capture_to_tmp(area: Dict, tmp_dir: str, ts: str) -> str:
    mesa = int(area["mesa"])
    x1, y1, x2, y2 = int(area["x1"]), int(area["y1"]), int(area["x2"]), int(area["y2"])
    bbox = (x1, y1, x2, y2)

    img = ImageGrab.grab(bbox=bbox).convert("RGB")
    path = os.path.join(tmp_dir, f"{ts}__mesa_{mesa}.bmp")
    img.save(path, format="BMP")
    return path
