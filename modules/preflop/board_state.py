# C:\Users\Usuario\Desktop\proyectos\poker_boss\modules\preflop\board_state.py
from __future__ import annotations

import os
import sys

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

import json
import time as t
import hashlib
from PIL import Image
import numpy as np

from modules.preflop.mano import match_card_opencv, load_templates, RANKS, SUITS

# --------------------------------------------------------------------
# ROIs PROVISIONALES para las 3 cartas del flop dentro de la imagen de mesa.
# Ajustar si hace falta tras la primera prueba real.
# Formato: (x, y, w, h)
# --------------------------------------------------------------------
FLOP_CARD_ROIS = [
    (248, 222, 32, 42),  # flop 1
    (307, 222, 32, 42),  # flop 2
    (366, 222, 32, 42),  # flop 3
]

CARD_SCORE_MIN = 0.72


def _sha1(s: str) -> str:
    return hashlib.sha1(s.encode("utf-8", errors="ignore")).hexdigest()


def _fingerprint(image_path: str) -> str:
    abs_image_path = os.path.abspath(image_path or "")
    return _sha1(abs_image_path + "|board_state|" + str(int(t.time()) // 2))


def _is_valid_rank(rank: str) -> bool:
    return str(rank) in set(RANKS)


def _is_valid_suit(suit: str) -> bool:
    return str(suit) in set(SUITS)


def _is_valid_card(rank: str, suit: str, score: float) -> bool:
    return _is_valid_rank(rank) and _is_valid_suit(suit) and float(score) >= CARD_SCORE_MIN


def main() -> None:
    try:
        if "--image" not in sys.argv:
            raise Exception("Missing --image argument")

        image_path = sys.argv[sys.argv.index("--image") + 1]
        abs_image_path = os.path.abspath(image_path)

        if not os.path.exists(abs_image_path):
            raise Exception("Image not found")

        img = Image.open(abs_image_path).convert("L")
        arr = np.array(img, dtype=np.uint8)

        templates = load_templates()

        cards = []
        valid_count = 0

        for idx, (x, y, w, h) in enumerate(FLOP_CARD_ROIS, start=1):
            if arr.shape[0] < y + h or arr.shape[1] < x + w:
                raise Exception(f"ROI out of bounds for flop_{idx}")

            crop = arr[y : y + h, x : x + w]
            label, rank, suit, score = match_card_opencv(crop, templates)

            valid = _is_valid_card(rank, suit, score)
            if valid:
                valid_count += 1

            cards.append(
                {
                    "idx": idx,
                    "roi": [x, y, w, h],
                    "label": str(label),
                    "rank": str(rank),
                    "suit": str(suit),
                    "score": float(score),
                    "valid": bool(valid),
                }
            )

        if valid_count >= 3:
            street_state = "postflop"
        elif valid_count == 0:
            street_state = "preflop"
        else:
            street_state = "unknown"

        out = {
            "street_state": street_state,
            "valid_count": int(valid_count),
            "cards": cards,
            "score_min": float(CARD_SCORE_MIN),
            "fingerprint": _fingerprint(abs_image_path),
        }
        print(json.dumps(out))
        return

    except Exception as e:
        try:
            image_path = sys.argv[sys.argv.index("--image") + 1] if "--image" in sys.argv else ""
        except Exception:
            image_path = ""

        out = {
            "street_state": "unknown",
            "valid_count": 0,
            "cards": [],
            "score_min": float(CARD_SCORE_MIN),
            "fingerprint": _fingerprint(image_path),
            "error": str(e),
        }
        print(json.dumps(out))
        return


if __name__ == "__main__":
    main()
