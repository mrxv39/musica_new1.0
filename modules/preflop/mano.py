# C:\Users\Usuario\Desktop\proyectos\poker_boss\modules\preflop\mano.py
import sys
import os
import json
import time
import hashlib
from typing import Dict, List, Tuple
from PIL import Image
import numpy as np

SUITS = ["c", "d", "h", "s"]
RANKS = ["A", "K", "Q", "J", "T", "9", "8", "7", "6", "5", "4", "3", "2"]
THRESHOLD = 0.60
SUIT_THRESHOLD = 0.45

# Coordenadas ajustadas para capturas 900x900 aprox.; el símbolo de palo
# del héroe queda dentro de un recorte pequeño separado del índice/rango.
region_palo1 = (360, 405, 30, 40)
region_palo2 = (410, 405, 30, 40)
region_carta1 = (339, 408, 35, 35)
region_carta2 = (389, 408, 35, 35)

DEFAULT_TEMPLATE_DIR = os.path.join(os.path.dirname(__file__), "templates")
DEFAULT_RANK_TEMPLATE_ROOT = os.path.join(DEFAULT_TEMPLATE_DIR, "ranks")
DEFAULT_SUIT_TEMPLATE_ROOT = os.path.join(DEFAULT_TEMPLATE_DIR, "suits")
TEMPLATE_ROOT = os.environ.get("MANO_TEMPLATE_ROOT", DEFAULT_RANK_TEMPLATE_ROOT)
SUIT_TEMPLATE_ROOT = os.environ.get("MANO_SUIT_TEMPLATE_ROOT")


def _sha1(s: str) -> str:
    return hashlib.sha1(s.encode("utf-8", errors="ignore")).hexdigest()


def _fingerprint_fallback(image_path: str) -> str:
    # Fingerprint NO vacío incluso en error
    abs_path = os.path.abspath(image_path or "")
    return _sha1(abs_path + "|" + str(int(time.time()) // 2))


def _load_gray_image(path: str) -> np.ndarray | None:
    try:
        img = Image.open(path).convert("L")
        return np.array(img, dtype=np.uint8)
    except Exception:
        return None


def _load_rgb_image(path: str) -> np.ndarray | None:
    try:
        img = Image.open(path).convert("RGB")
        return np.array(img, dtype=np.uint8)
    except Exception:
        return None


def _resolve_rank_template_root() -> str:
    root = TEMPLATE_ROOT
    if os.path.isdir(os.path.join(root, "cartasc")):
        return root
    candidate = os.path.join(root, "ranks")
    if os.path.isdir(candidate):
        return candidate
    if os.path.isdir(root):
        return root
    return DEFAULT_RANK_TEMPLATE_ROOT


def _resolve_suit_template_root() -> str:
    if SUIT_TEMPLATE_ROOT and os.path.isdir(SUIT_TEMPLATE_ROOT):
        return SUIT_TEMPLATE_ROOT

    rank_root = _resolve_rank_template_root()
    sibling_root = os.path.join(os.path.dirname(rank_root), "suits")
    if os.path.isdir(sibling_root):
        return sibling_root

    candidate = os.path.join(TEMPLATE_ROOT, "suits")
    if os.path.isdir(candidate):
        return candidate

    if TEMPLATE_ROOT == DEFAULT_RANK_TEMPLATE_ROOT and os.path.isdir(DEFAULT_SUIT_TEMPLATE_ROOT):
        return DEFAULT_SUIT_TEMPLATE_ROOT

    return ""


def load_templates() -> Dict[Tuple[str, str], np.ndarray]:
    templates = {}
    rank_root = _resolve_rank_template_root()
    for suit in SUITS:
        for rank in RANKS:
            path = os.path.join(rank_root, f"cartas{suit}", f"{rank}.png")
            tmpl = _load_gray_image(path)
            if tmpl is not None:
                templates[(suit, rank)] = tmpl
    return templates


def load_suit_templates() -> Dict[str, np.ndarray]:
    templates: Dict[str, np.ndarray] = {}
    suit_root = _resolve_suit_template_root()
    for suit in SUITS:
        for filename in (f"{suit}.png", f"{suit.upper()}.png"):
            path = os.path.join(suit_root, filename)
            tmpl = _load_rgb_image(path)
            if tmpl is not None:
                templates[suit] = tmpl
                break
    return templates


def extract_card_crops(img: Image.Image) -> Tuple[np.ndarray, np.ndarray]:
    c1 = img.crop((region_carta1[0], region_carta1[1], region_carta1[0] + region_carta1[2], region_carta1[1] + region_carta1[3]))
    c2 = img.crop((region_carta2[0], region_carta2[1], region_carta2[0] + region_carta2[2], region_carta2[1] + region_carta2[3]))
    crop1 = np.array(c1, dtype=np.uint8)
    crop2 = np.array(c2, dtype=np.uint8)
    return crop1, crop2


def extract_suit_crops(img: Image.Image) -> Tuple[np.ndarray, np.ndarray]:
    s1 = img.crop((region_palo1[0], region_palo1[1], region_palo1[0] + region_palo1[2], region_palo1[1] + region_palo1[3]))
    s2 = img.crop((region_palo2[0], region_palo2[1], region_palo2[0] + region_palo2[2], region_palo2[1] + region_palo2[3]))
    crop1 = np.array(s1, dtype=np.uint8)
    crop2 = np.array(s2, dtype=np.uint8)
    return crop1, crop2


def _match_template_score(crop_gray: np.ndarray, tmpl: np.ndarray) -> float | None:
    import cv2  # type: ignore

    if tmpl is None:
        return None
    if crop_gray.ndim != tmpl.ndim:
        if crop_gray.ndim == 3 and tmpl.ndim == 2:
            crop_gray = cv2.cvtColor(crop_gray, cv2.COLOR_RGB2GRAY)
        elif crop_gray.ndim == 2 and tmpl.ndim == 3:
            crop_gray = cv2.cvtColor(crop_gray, cv2.COLOR_GRAY2RGB)
        else:
            return None
    if tmpl.shape[0] > crop_gray.shape[0] or tmpl.shape[1] > crop_gray.shape[1]:
        return None
    try:
        res = cv2.matchTemplate(crop_gray, tmpl, cv2.TM_CCOEFF_NORMED)
        _, max_val, _, _ = cv2.minMaxLoc(res)
        return float(max_val)
    except Exception:
        return None


def debug_match_card_opencv(
    crop_gray: np.ndarray,
    templates: dict,
    top_n: int = 5,
) -> List[Tuple[str, str, str, float]]:
    """
    Devuelve una lista ordenada de las top-N coincidencias:
    [(label, rank, suit, score), ...] con score de mayor a menor.
    """
    matches: List[Tuple[str, str, str, float]] = []

    # Asegurar uint8
    if crop_gray.dtype != np.uint8:
        crop_gray = crop_gray.astype(np.uint8)

    for (suit, rank), tmpl in templates.items():
        score = _match_template_score(crop_gray, tmpl)
        if score is None:
            continue
        matches.append((f"{rank}{suit}", rank, suit, score))

    matches.sort(key=lambda item: item[3], reverse=True)
    if top_n <= 0:
        return matches
    return matches[:top_n]


def debug_match_rank_opencv(
    crop_gray: np.ndarray,
    templates: Dict[Tuple[str, str], np.ndarray],
    top_n: int = 5,
) -> List[Tuple[str, float]]:
    rank_scores: Dict[str, float] = {}
    for (_suit, rank), tmpl in templates.items():
        score = _match_template_score(crop_gray, tmpl)
        if score is None:
            continue
        rank_scores[rank] = max(rank_scores.get(rank, -1.0), score)

    matches = sorted(rank_scores.items(), key=lambda item: item[1], reverse=True)
    if top_n <= 0:
        return matches
    return matches[:top_n]


def match_card_opencv(crop_gray: np.ndarray, templates: dict):
    top_matches = debug_match_card_opencv(crop_gray, templates, top_n=1)

    if not top_matches:
        return "UNKNOWN", "UNKNOWN", "UNKNOWN", 0.0

    return top_matches[0]


def _disambiguate_6_9(crop_gray: np.ndarray) -> str:
    """Distinguish 6 from 9 by finding the 'neck' (narrowest row between the
    stem and the loop). In a 6 the neck is in the upper third; in a 9 it's
    in the lower third. We only analyze the left ~60% of the crop to exclude
    the suit symbol."""
    import cv2  # type: ignore

    gray = crop_gray
    if gray.ndim == 3:
        gray = cv2.cvtColor(gray, cv2.COLOR_RGB2GRAY)
    h, w = gray.shape[:2]
    if h < 10:
        return "6"
    # Use only the left portion (digit, not suit)
    digit_w = int(w * 0.6)
    digit_crop = gray[:, :digit_w]
    _, bw = cv2.threshold(digit_crop, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    # Compute row spans (width of white pixels per row)
    spans = []
    for r in range(h):
        row_pixels = np.where(bw[r, :] > 128)[0]
        spans.append(int(row_pixels[-1] - row_pixels[0]) if len(row_pixels) >= 2 else 0)
    # Find the active rows (non-zero span) to define the digit bounds
    active = [r for r in range(h) if spans[r] > 0]
    if len(active) < 5:
        return "6"
    top_row, bot_row = active[0], active[-1]
    digit_h = bot_row - top_row + 1
    # Find the neck: the row with the minimum span AMONG active rows
    # in the middle 60% of the digit
    margin = int(digit_h * 0.2)
    search_start = top_row + margin
    search_end = bot_row - margin
    neck_row = search_start
    neck_span = 9999
    for r in range(search_start, search_end + 1):
        if spans[r] > 0 and spans[r] < neck_span:
            neck_span = spans[r]
            neck_row = r
    # Compare neck position relative to digit center
    digit_center = (top_row + bot_row) / 2.0
    return "6" if neck_row < digit_center else "9"


def match_rank_opencv(crop_gray: np.ndarray, templates: Dict[Tuple[str, str], np.ndarray]) -> Tuple[str, float]:
    top_matches = debug_match_rank_opencv(crop_gray, templates, top_n=5)
    if not top_matches:
        return "UNKNOWN", 0.0
    rank, score = top_matches[0]
    scores = dict(top_matches)
    score_6 = scores.get("6", 0.0)
    score_9 = scores.get("9", 0.0)

    # Case 1: winner is 6 or 9 — disambiguate if the other is close
    if rank in ("6", "9"):
        other = "9" if rank == "6" else "6"
        other_score = scores.get(other, 0.0)
        if other_score > 0.55 and (score - other_score) < 0.15:
            resolved = _disambiguate_6_9(crop_gray)
            return resolved, float(scores.get(resolved, score))

    # Case 2: winner is NOT 6/9 but both 6 and 9 are close to the winner
    # (e.g. Q=0.71, 9=0.70, 6=0.67 — the real card might be 6 misread)
    if score_6 > 0.55 and score_9 > 0.55:
        best_69 = max(score_6, score_9)
        if (score - best_69) < 0.05:  # very close to winner
            resolved = _disambiguate_6_9(crop_gray)
            resolved_score = scores.get(resolved, best_69)
            if resolved_score > 0.55:
                return resolved, float(resolved_score)

    return rank, float(score)


def match_suit_opencv(crop_gray: np.ndarray, suit_templates: dict) -> tuple[str, float]:
    """
    Devuelve (suit, score), con suit en {"c","d","h","s"}.
    """
    if crop_gray.dtype != np.uint8:
        crop_gray = crop_gray.astype(np.uint8)

    best_suit = "UNKNOWN"
    best_score = 0.0

    for suit, tmpl in suit_templates.items():
        score = _match_template_score(crop_gray, tmpl)
        if score is None:
            continue
        if score > best_score:
            best_suit = str(suit)
            best_score = float(score)

    return best_suit, float(best_score)


def detect_card(
    card_crop: np.ndarray,
    suit_crop: np.ndarray,
    rank_templates: Dict[Tuple[str, str], np.ndarray],
    suit_templates: Dict[str, np.ndarray],
) -> Tuple[str, str, str, float, float]:
    rank, rank_score = match_rank_opencv(card_crop, rank_templates)

    if suit_templates:
        suit, suit_score = match_suit_opencv(suit_crop, suit_templates)
    else:
        _card, _rank, suit, suit_score = match_card_opencv(card_crop, rank_templates)

    if rank == "UNKNOWN" or suit == "UNKNOWN":
        return "UNKNOWN", rank, suit, float(rank_score), float(suit_score)

    return f"{rank}{suit}", rank, suit, float(rank_score), float(suit_score)


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


def run_mano(image_path: str, templates=None, suit_templates=None) -> dict:
    """Direct-call entry point (no subprocess). Returns the same dict as main()."""
    abs_image_path = os.path.abspath(image_path)
    try:
        if not os.path.exists(abs_image_path):
            raise Exception("Image not found")

        if templates is None:
            templates = load_templates()
        if not templates:
            raise Exception("Templates missing")
        if suit_templates is None:
            suit_templates = load_suit_templates()

        raw_img = Image.open(abs_image_path)
        gray_img = raw_img.convert("L")
        rgb_img = raw_img.convert("RGB")

        crop1, crop2 = extract_card_crops(gray_img)
        suit_crop1, suit_crop2 = extract_suit_crops(rgb_img)

        card1, rank1, suit1, rank_score1, suit_score1 = detect_card(crop1, suit_crop1, templates, suit_templates)
        card2, rank2, suit2, rank_score2, suit_score2 = detect_card(crop2, suit_crop2, templates, suit_templates)

        score1 = min(rank_score1, suit_score1) if suit_templates else rank_score1
        score2 = min(rank_score2, suit_score2) if suit_templates else rank_score2
        mano_raw, hand_rank, hand_class, suited = classify_hand(card1, card2)

        suits_ok = True
        if suit_templates:
            suits_ok = bool(
                (suit1 != "UNKNOWN") and (suit2 != "UNKNOWN")
                and (float(suit_score1) >= SUIT_THRESHOLD)
                and (float(suit_score2) >= SUIT_THRESHOLD)
            )

        valid = bool(
            (rank1 != "UNKNOWN") and (rank2 != "UNKNOWN")
            and (float(rank_score1) >= THRESHOLD)
            and (float(rank_score2) >= THRESHOLD)
            and suits_ok
        )

        fingerprint = _sha1(abs_image_path + "|" + mano_raw + "|" + str(int(time.time()) // 2))

        return {
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
    except Exception as e:
        fp = _fingerprint_fallback(image_path)
        return {
            "valid": False, "card1": "UNKNOWN", "card2": "UNKNOWN",
            "score1": 0.0, "score2": 0.0, "fingerprint": fp,
            "mano_raw": "UNKNOWNUNKNOWN", "hand_rank": "??",
            "hand_class": "??", "suited": False, "error": str(e),
        }


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
        suit_templates = load_suit_templates()

        # Leer imagen una vez: rango en gris, palo en RGB.
        raw_img = Image.open(abs_image_path)
        gray_img = raw_img.convert("L")
        rgb_img = raw_img.convert("RGB")

        crop1, crop2 = extract_card_crops(gray_img)
        suit_crop1, suit_crop2 = extract_suit_crops(rgb_img)

        # Match con OpenCV
        try:
            card1, rank1, suit1, rank_score1, suit_score1 = detect_card(crop1, suit_crop1, templates, suit_templates)
            card2, rank2, suit2, rank_score2, suit_score2 = detect_card(crop2, suit_crop2, templates, suit_templates)
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

        score1 = min(rank_score1, suit_score1) if suit_templates else rank_score1
        score2 = min(rank_score2, suit_score2) if suit_templates else rank_score2
        mano_raw, hand_rank, hand_class, suited = classify_hand(card1, card2)

        suits_ok = True
        if suit_templates:
            suits_ok = bool(
                (suit1 != "UNKNOWN")
                and (suit2 != "UNKNOWN")
                and (float(suit_score1) >= SUIT_THRESHOLD)
                and (float(suit_score2) >= SUIT_THRESHOLD)
            )

        valid = bool(
            (rank1 != "UNKNOWN")
            and (rank2 != "UNKNOWN")
            and (float(rank_score1) >= THRESHOLD)
            and (float(rank_score2) >= THRESHOLD)
            and suits_ok
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
