# C:\Users\Usuario\Desktop\proyectos\musica_new\modules\preflop\mano.py
import sys
import os
import json
import time
import hashlib
from PIL import Image
import numpy as np

SUITS = ["c", "d", "h", "s"]
RANKS = ["A", "K", "Q", "J", "T", "9", "8", "7", "6", "5", "4", "3", "2"]
THRESHOLD = 0.60

region_palo1 = (360, 405, 30, 40)
region_palo2 = (410, 405, 30, 40)
region_carta1 = (339, 408, 35, 35)
region_carta2 = (389, 408, 35, 35)

DEFAULT_TEMPLATE_ROOT = os.path.join(os.path.dirname(__file__), "templates", "ranks")
TEMPLATE_ROOT = os.environ.get("MANO_TEMPLATE_ROOT", DEFAULT_TEMPLATE_ROOT)


def _sha1(s: str) -> str:
    return hashlib.sha1(s.encode("utf-8", errors="ignore")).hexdigest()


def _fingerprint_fallback(image_path: str) -> str:
    # Fingerprint NO vacío incluso en error
    abs_path = os.path.abspath(image_path or "")
    return _sha1(abs_path + "|" + str(int(time.time()) // 2))


def load_templates():
    templates = {}
    for suit in SUITS:
        for rank in RANKS:
            path = os.path.join(TEMPLATE_ROOT, f"cartas{suit}", f"{rank}.png")
            if os.path.exists(path):
                try:
                    img = Image.open(path).convert("L")
                    templates[(suit, rank)] = np.array(img, dtype=np.uint8)
                except Exception:
                    pass
    return templates


def match_card_opencv(crop_gray: np.ndarray, templates: dict):
    """
    Devuelve: label ("9c"), rank ("9"), suit ("c"), score (float)
    """
    # Importar cv2 aquí para que si falta, podamos devolver JSON controlado
    import cv2  # type: ignore

    best_score = -1.0
    best_suit = "UNKNOWN"
    best_rank = "UNKNOWN"

    # Asegurar uint8
    if crop_gray.dtype != np.uint8:
        crop_gray = crop_gray.astype(np.uint8)

    for (suit, rank), tmpl in templates.items():
        if tmpl is None:
            continue
        # Si template mayor que crop, skip
        if tmpl.shape[0] > crop_gray.shape[0] or tmpl.shape[1] > crop_gray.shape[1]:
            continue
        try:
            res = cv2.matchTemplate(crop_gray, tmpl, cv2.TM_CCOEFF_NORMED)
            _, max_val, _, _ = cv2.minMaxLoc(res)
            score = float(max_val)
        except Exception:
            continue

        if score > best_score:
            best_score = score
            best_suit = suit
            best_rank = rank

    if best_rank == "UNKNOWN":
        return "UNKNOWN", "UNKNOWN", "UNKNOWN", 0.0

    return f"{best_rank}{best_suit}", best_rank, best_suit, float(best_score)


def classify_hand(card1: str, card2: str):
    """
    card1/card2: "9c", "As", etc.
    Devuelve: mano_raw, hand_rank, hand_class, suited(bool)
    """
    if len(card1) < 2 or len(card2) < 2:
        return "UNKNOWNUNKNOWN", "??", "??", False

    r1, s1 = card1[0], card1[-1]
    r2, s2 = card2[0], card2[-1]

    mano_raw = f"{r1}{s1}{r2}{s2}"

    if r1 == "UNKNOWN" or r2 == "UNKNOWN":
        return mano_raw, "??", "??", False

    if r1 == r2:
        # Par
        hand_rank = f"{r1}{r1}"
        return mano_raw, hand_rank, hand_rank, False

    # Orden por fuerza
    order = {r: i for i, r in enumerate(RANKS)}  # A=0 ... 2=12
    # menor índice => más fuerte
    a, b = (r1, r2)
    if order.get(a, 99) <= order.get(b, 99):
        hi, lo = a, b
        suit_hi, suit_lo = s1, s2
    else:
        hi, lo = b, a
        suit_hi, suit_lo = s2, s1

    hand_rank = f"{hi}{lo}"
    suited = (suit_hi == suit_lo)
    hand_class = hand_rank + ("s" if suited else "o")
    return mano_raw, hand_rank, hand_class, bool(suited)


def main():
    # SIEMPRE un JSON en stdout
    try:
        if "--image" not in sys.argv:
            raise Exception("Missing --image argument")

        image_path = sys.argv[sys.argv.index("--image") + 1].strip()
        abs_image_path = os.path.abspath(image_path)

        if not os.path.exists(abs_image_path):
            raise Exception("Image not found")

        templates = load_templates()
        if not templates:
            raise Exception("Templates missing")

        # Leer imagen
        img = Image.open(abs_image_path).convert("L")

        c1 = img.crop((region_carta1[0], region_carta1[1], region_carta1[0] + region_carta1[2], region_carta1[1] + region_carta1[3]))
        c2 = img.crop((region_carta2[0], region_carta2[1], region_carta2[0] + region_carta2[2], region_carta2[1] + region_carta2[3]))

        crop1 = np.array(c1, dtype=np.uint8)
        crop2 = np.array(c2, dtype=np.uint8)

        # Match con OpenCV
        try:
            card1, rank1, suit1, score1 = match_card_opencv(crop1, templates)
            card2, rank2, suit2, score2 = match_card_opencv(crop2, templates)
        except ModuleNotFoundError:
            # cv2 no instalado
            fp = _fingerprint_fallback(abs_image_path)
            out = {
                "valid": False,
                "card1": "UNKNOWN",
                "card2": "UNKNOWN",
                "score1": 0.0,
                "score2": 0.0,
                "fingerprint": fp,
                "mano_raw": "UNKNOWNUNKNOWN",
                "hand_rank": "??",
                "hand_class": "??",
                "suited": False,
                "error": "cv2_missing",
            }
            print(json.dumps(out, ensure_ascii=False))
            return

        mano_raw, hand_rank, hand_class, suited = classify_hand(card1, card2)

        valid = bool(
            (rank1 != "UNKNOWN")
            and (rank2 != "UNKNOWN")
            and (float(score1) >= THRESHOLD)
            and (float(score2) >= THRESHOLD)
        )

        fingerprint = _sha1(abs_image_path + "|" + mano_raw + "|" + str(int(time.time()) // 2))

        out = {
            "valid": bool(valid),
            "card1": str(card1),
            "card2": str(card2),
            "score1": float(score1),
            "score2": float(score2),
            "fingerprint": str(fingerprint),
            "mano_raw": str(mano_raw),
            "hand_rank": str(hand_rank),
            "hand_class": str(hand_class),
            "suited": bool(suited),
        }
        print(json.dumps(out, ensure_ascii=False))
    except Exception as e:
        # SIEMPRE fingerprint no vacío
        fp = _fingerprint_fallback(sys.argv[sys.argv.index("--image") + 1] if "--image" in sys.argv else "")
        out = {
            "valid": False,
            "card1": "UNKNOWN",
            "card2": "UNKNOWN",
            "score1": 0.0,
            "score2": 0.0,
            "fingerprint": fp,
            "mano_raw": "UNKNOWNUNKNOWN",
            "hand_rank": "??",
            "hand_class": "??",
            "suited": False,
            "error": str(e),
        }
        print(json.dumps(out, ensure_ascii=False))


if __name__ == "__main__":
    main()
