# C:\Users\Usuario\Desktop\proyectos\poker_boss\modules\ocr\dealer.py
# Detect dealer button via template matching and map it to a seat (p1/p2/p3).
# Strategy:
#  - Match dealer.png on the whole screenshot (fast enough for one frame)
#  - If best match score >= threshold -> we get the (x,y) of the match center
#  - Map that point to nearest seat center (relative coordinates)
#  - Return dealer_seat + debug info
#
# Notes:
#  - This avoids needing per-seat ROI coordinates.
#  - Works best when table layout is consistent (p1 bottom, p2 left, p3 right).

from __future__ import annotations

import os
from typing import Dict, Any, Optional, Tuple

import cv2
import numpy as np


def _template_path() -> str:
    # modules/ocr/dealer.py -> modules/preflop/templates/dealer.png
    here = os.path.dirname(os.path.abspath(__file__))
    tpl = os.path.normpath(os.path.join(here, "..", "preflop", "templates", "dealer.png"))
    return tpl


def _seat_centers_rel() -> Dict[str, Tuple[float, float]]:
    """
    Seat centers in RELATIVE coordinates (x_frac, y_frac) for your table layout.
    Adjust these if needed.
      - p1: bottom center
      - p2: top-left
      - p3: top-right
    """
    return {
        "p1": (0.50, 0.83),
        "p2": (0.16, 0.26),
        "p3": (0.84, 0.26),
    }


def _dist2(ax: float, ay: float, bx: float, by: float) -> float:
    dx = ax - bx
    dy = ay - by
    return dx * dx + dy * dy


def read_dealer(
    image_path: str,
    x1: int = 0,
    y1: int = 0,
    threshold: float = 0.85,
    active_seats: Optional[list] = None,
) -> Dict[str, Any]:
    """
    Returns:
      {
        "ok": bool,
        "dealer_seat": "p1|p2|p3|",
        "score": float,
        "method": "template_match_fullframe_nearest_seat",
        "errors": [],
        "debug": {...}
      }
    """
    out: Dict[str, Any] = {
        "ok": False,
        "dealer_seat": "",
        "score": 0.0,
        "method": "template_match_fullframe_nearest_seat",
        "errors": [],
        "debug": {},
    }

    if not image_path:
        out["errors"].append("no_image")
        return out

    tpl_path = _template_path()
    if not os.path.exists(tpl_path):
        out["errors"].append(f"template_not_found:{tpl_path}")
        return out

    try:
        img = cv2.imread(image_path, cv2.IMREAD_COLOR)
        if img is None:
            out["errors"].append("image_read_failed")
            return out

        tpl = cv2.imread(tpl_path, cv2.IMREAD_COLOR)
        if tpl is None:
            out["errors"].append("template_read_failed")
            return out

        img_gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        tpl_gray = cv2.cvtColor(tpl, cv2.COLOR_BGR2GRAY)

        # Match template
        res = cv2.matchTemplate(img_gray, tpl_gray, cv2.TM_CCOEFF_NORMED)
        min_val, max_val, min_loc, max_loc = cv2.minMaxLoc(res)

        out["score"] = float(max_val)
        out["debug"]["max_loc"] = [int(max_loc[0]), int(max_loc[1])]
        out["debug"]["min_loc"] = [int(min_loc[0]), int(min_loc[1])]
        out["debug"]["threshold"] = float(threshold)

        if max_val < threshold:
            out["errors"].append("dealer_not_found")
            return out

        # Compute match center in absolute coords
        th, tw = tpl_gray.shape[:2]
        center_x = int(max_loc[0] + tw / 2)
        center_y = int(max_loc[1] + th / 2)

        # Map to nearest seat center
        h, w = img_gray.shape[:2]
        sx = center_x / max(w, 1)
        sy = center_y / max(h, 1)

        centers_rel = _seat_centers_rel()

        # If active_seats provided, only consider those seats
        seats = ["p1", "p2", "p3"]
        if active_seats:
            seats = [s for s in seats if s in active_seats] or seats

        best_seat = ""
        best_d2 = 1e9
        for seat in seats:
            cx, cy = centers_rel.get(seat, (0.5, 0.5))
            d2 = _dist2(sx, sy, cx, cy)
            if d2 < best_d2:
                best_d2 = d2
                best_seat = seat

        out["dealer_seat"] = best_seat
        out["ok"] = bool(best_seat)

        out["debug"]["match_center_px"] = [center_x, center_y]
        out["debug"]["match_center_rel"] = [float(sx), float(sy)]
        out["debug"]["seat_centers_rel"] = {k: [v[0], v[1]] for k, v in centers_rel.items()}
        out["debug"]["active_seats_used"] = seats

        if not out["ok"]:
            out["errors"].append("dealer_seat_not_mapped")

        return out

    except Exception as e:
        out["errors"].append(f"exception:{e}")
        return out


if __name__ == "__main__":
    import json
    import sys

    image_path = None
    if "--image" in sys.argv:
        try:
            image_path = sys.argv[sys.argv.index("--image") + 1]
        except Exception:
            image_path = None

    res = read_dealer(image_path) if image_path else {"ok": False, "errors": ["no_image"]}
    print(json.dumps(res, ensure_ascii=False))