# C:\Users\Usuario\Desktop\proyectos\poker_boss\modules\preflop\workers_loop\capture.py
from __future__ import annotations

import os
from typing import Dict, Tuple

from PIL import ImageGrab


def capture_bbox_to_path(bbox: Tuple[int, int, int, int], out_path: str) -> str:
    img = ImageGrab.grab(bbox=bbox).convert("RGB")
    os.makedirs(os.path.dirname(os.path.abspath(out_path)), exist_ok=True)
    img.save(out_path, format="BMP")
    return out_path


def capture_bbox_to_tmp(bbox: Tuple[int, int, int, int], tmp_dir: str, file_name: str) -> str:
    path = os.path.join(tmp_dir, file_name)
    return capture_bbox_to_path(bbox, path)


def capture_to_tmp(area: Dict, tmp_dir: str, ts: str) -> str:
    mesa = int(area["mesa"])
    x1, y1, x2, y2 = int(area["x1"]), int(area["y1"]), int(area["x2"]), int(area["y2"])
    bbox = (x1, y1, x2, y2)
    path = os.path.join(tmp_dir, f"{ts}__mesa_{mesa}.bmp")
    return capture_bbox_to_path(bbox, path)
