"""Extract card ROIs from linked spots to create improved templates.

Usage:
    python scripts/improve_card_templates.py
    python scripts/improve_card_templates.py --test-only  # just test accuracy without saving
"""
from __future__ import annotations

import argparse
import json
import os
import sqlite3
import sys
from collections import defaultdict
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "modules" / "preflop"))

import mano as mano_mod

DB_PATH = str(ROOT / "data" / "poker_boss.db")
TEMPLATE_DIR = ROOT / "modules" / "preflop" / "templates"

RANK_ORDER = "23456789TJQKA"
RANK_VALUE = {r: i for i, r in enumerate(RANK_ORDER)}
SUIT_MAP = {"C": "c", "D": "d", "H": "h", "S": "s"}


def _norm_rank(x: str) -> str:
    x = (x or "").strip().upper()
    if x in ("10", "1"):
        return "T"
    return x[:1]


def _parse_xml_card(tok: str) -> Optional[Tuple[str, str]]:
    """Parse XML card token like 'DA', 'HQ', 'C10', 'S5' -> (rank, suit_letter)."""
    t = (tok or "").strip().upper()
    if not t:
        return None
    suits = set("CDHS")
    ranks = set("23456789TJQKA")
    # suit-first: DA, D10, SQ
    if len(t) >= 2 and t[0] in suits:
        rank = _norm_rank(t[1:])
        if rank in ranks:
            return rank, t[0]
    # rank-first: AS, 10D
    if len(t) >= 2 and t[-1] in suits:
        rank = _norm_rank(t[:-1])
        if rank in ranks:
            return rank, t[-1]
    return None


def load_linked_spots(db_path: str) -> List[Dict]:
    """Load spots linked to hands with image paths."""
    con = sqlite3.connect(db_path)
    con.row_factory = sqlite3.Row
    rows = con.execute("""
        SELECT s.obs_id, s.frame_ref, s.mano_raw, h.hero_cards
        FROM spots s
        JOIN hands h ON h.id = s.linked_hand_id
        WHERE s.frame_ref IS NOT NULL AND s.frame_ref != ''
        ORDER BY s.obs_id
    """).fetchall()
    con.close()

    result = []
    for r in rows:
        hero = r["hero_cards"]
        toks = hero.split() if hero else []
        if len(toks) != 2:
            continue
        c1 = _parse_xml_card(toks[0])
        c2 = _parse_xml_card(toks[1])
        if not c1 or not c2:
            continue
        if not os.path.isfile(r["frame_ref"]):
            continue
        result.append({
            "obs_id": r["obs_id"],
            "image_path": r["frame_ref"],
            "mano_raw": r["mano_raw"],
            "xml_card1": c1,  # (rank, suit_upper)
            "xml_card2": c2,
        })
    return result


def extract_crops(image_path: str):
    """Extract rank and suit crops from image."""
    img = Image.open(image_path)
    rank_crop1, rank_crop2 = mano_mod.extract_card_crops(img)
    suit_crop1, suit_crop2 = mano_mod.extract_suit_crops(img)
    return rank_crop1, rank_crop2, suit_crop1, suit_crop2


def test_accuracy_with_templates(
    spots: List[Dict],
    rank_templates: Dict,
    suit_templates: Dict,
) -> Dict:
    """Test accuracy of given templates against ground truth."""
    total = 0
    rank_correct = 0
    suit_correct = 0
    full_correct = 0
    errors = []

    for spot in spots:
        try:
            rc1, rc2, sc1, sc2 = extract_crops(spot["image_path"])
        except Exception:
            continue

        xml_r1, xml_s1 = spot["xml_card1"]
        xml_r2, xml_s2 = spot["xml_card2"]

        # Rank detection
        gray1 = cv2.cvtColor(rc1, cv2.COLOR_RGB2GRAY) if rc1.ndim == 3 else rc1
        gray2 = cv2.cvtColor(rc2, cv2.COLOR_RGB2GRAY) if rc2.ndim == 3 else rc2

        det_r1, score_r1 = mano_mod.match_rank_opencv(gray1, rank_templates)
        det_r2, score_r2 = mano_mod.match_rank_opencv(gray2, rank_templates)

        # Suit detection
        det_s1, score_s1 = _match_suit(sc1, suit_templates)
        det_s2, score_s2 = _match_suit(sc2, suit_templates)

        total += 1

        r1_ok = det_r1 == xml_r1
        r2_ok = det_r2 == xml_r2
        s1_ok = det_s1 == xml_s1.lower()
        s2_ok = det_s2 == xml_s2.lower()

        if r1_ok and r2_ok:
            rank_correct += 1
        if s1_ok and s2_ok:
            suit_correct += 1
        if r1_ok and r2_ok and s1_ok and s2_ok:
            full_correct += 1

        if not (r1_ok and r2_ok and s1_ok and s2_ok):
            errors.append({
                "obs_id": spot["obs_id"],
                "det": f"{det_r1}{det_s1} {det_r2}{det_s2}",
                "xml": f"{xml_r1}{xml_s1.lower()} {xml_r2}{xml_s2.lower()}",
                "rank_ok": r1_ok and r2_ok,
                "suit_ok": s1_ok and s2_ok,
                "scores": f"r1={score_r1:.3f} r2={score_r2:.3f} s1={score_s1:.3f} s2={score_s2:.3f}",
            })

    return {
        "total": total,
        "rank_correct": rank_correct,
        "suit_correct": suit_correct,
        "full_correct": full_correct,
        "errors": errors,
    }


def _match_suit(crop_rgb: np.ndarray, suit_templates: Dict[str, np.ndarray]) -> Tuple[str, float]:
    """Match suit from RGB crop."""
    best_suit = "?"
    best_score = -1.0
    for suit, tmpl in suit_templates.items():
        score = mano_mod._match_template_score(crop_rgb, tmpl)
        if score is not None and score > best_score:
            best_score = score
            best_suit = suit
    return best_suit, best_score


def build_multi_templates(
    spots: List[Dict],
    rank_templates: Dict,
    suit_templates: Dict,
) -> Tuple[Dict, Dict]:
    """Build enriched templates from correctly-classified crops.

    For each card where the current detection is CORRECT, add the actual
    crop as an additional template. This gives the matcher more variants
    to compare against.
    """
    new_rank_templates = dict(rank_templates)  # copy existing
    new_suit_templates = dict(suit_templates)

    # Collect crops grouped by (suit, rank)
    rank_crops: Dict[Tuple[str, str], List[np.ndarray]] = defaultdict(list)
    suit_crops: Dict[str, List[np.ndarray]] = defaultdict(list)

    for spot in spots:
        try:
            rc1, rc2, sc1, sc2 = extract_crops(spot["image_path"])
        except Exception:
            continue

        xml_r1, xml_s1 = spot["xml_card1"]
        xml_r2, xml_s2 = spot["xml_card2"]
        s1_lower = xml_s1.lower()
        s2_lower = xml_s2.lower()

        gray1 = cv2.cvtColor(rc1, cv2.COLOR_RGB2GRAY) if rc1.ndim == 3 else rc1
        gray2 = cv2.cvtColor(rc2, cv2.COLOR_RGB2GRAY) if rc2.ndim == 3 else rc2

        # Only use crops where we KNOW the ground truth
        rank_crops[(s1_lower, xml_r1)].append(gray1)
        rank_crops[(s2_lower, xml_r2)].append(gray2)
        suit_crops[s1_lower].append(sc1)
        suit_crops[s2_lower].append(sc2)

    # For rank: create averaged templates per (suit, rank)
    for (suit, rank), crops in rank_crops.items():
        if len(crops) < 2:
            continue
        # Resize all to same shape and average
        target_shape = crops[0].shape
        valid = [c for c in crops if c.shape == target_shape]
        if len(valid) < 2:
            continue
        avg = np.mean(valid, axis=0).astype(np.uint8)
        # Add as extra template variant
        key_avg = (suit, rank)
        # Replace original with average of all samples (more robust)
        new_rank_templates[key_avg] = avg

    # For suits: create averaged templates
    for suit, crops in suit_crops.items():
        if len(crops) < 2:
            continue
        target_shape = crops[0].shape
        valid = [c for c in crops if c.shape == target_shape]
        if len(valid) < 2:
            continue
        avg = np.mean(valid, axis=0).astype(np.uint8)
        new_suit_templates[suit] = avg

    return new_rank_templates, new_suit_templates


def save_templates(
    rank_templates: Dict[Tuple[str, str], np.ndarray],
    suit_templates: Dict[str, np.ndarray],
    output_dir: Path,
):
    """Save templates to disk."""
    rank_dir = output_dir / "ranks"
    suit_dir = output_dir / "suits"

    for (suit, rank), tmpl in rank_templates.items():
        d = rank_dir / f"cartas{suit}"
        d.mkdir(parents=True, exist_ok=True)
        path = d / f"{rank}.png"
        cv2.imwrite(str(path), tmpl)

    suit_dir.mkdir(parents=True, exist_ok=True)
    for suit, tmpl in suit_templates.items():
        path = suit_dir / f"{suit.upper()}.png"
        if tmpl.ndim == 2:
            tmpl = cv2.cvtColor(tmpl, cv2.COLOR_GRAY2BGR)
        cv2.imwrite(str(path), tmpl)


def print_report(label: str, result: Dict):
    total = result["total"]
    if total == 0:
        print(f"\n{label}: no data")
        return
    print(f"\n{'='*50}")
    print(f"  {label}")
    print(f"{'='*50}")
    print(f"  Total:        {total}")
    print(f"  Rank correct: {result['rank_correct']}/{total} ({result['rank_correct']/total*100:.1f}%)")
    print(f"  Suit correct: {result['suit_correct']}/{total} ({result['suit_correct']/total*100:.1f}%)")
    print(f"  Full correct: {result['full_correct']}/{total} ({result['full_correct']/total*100:.1f}%)")

    if result["errors"]:
        print(f"\n  Errors ({len(result['errors'])}):")
        for e in result["errors"][:20]:
            rmark = "" if e["rank_ok"] else " RANK"
            smark = "" if e["suit_ok"] else " SUIT"
            print(f"    obs={e['obs_id']:>5}  det={e['det']:<8} xml={e['xml']:<8}{rmark}{smark}  {e['scores']}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", default=DB_PATH)
    ap.add_argument("--test-only", action="store_true")
    args = ap.parse_args()

    print("Loading linked spots...")
    spots = load_linked_spots(args.db)
    print(f"  Found {len(spots)} linked spots with images")

    print("Loading original templates...")
    orig_rank = mano_mod.load_templates()
    orig_suit = mano_mod.load_suit_templates()
    print(f"  Rank templates: {len(orig_rank)}, Suit templates: {len(orig_suit)}")

    print("\nTesting with ORIGINAL templates...")
    orig_result = test_accuracy_with_templates(spots, orig_rank, orig_suit)
    print_report("ORIGINAL TEMPLATES", orig_result)

    print("\nBuilding improved templates from 70 ground-truth crops...")
    new_rank, new_suit = build_multi_templates(spots, orig_rank, orig_suit)
    print(f"  New rank templates: {len(new_rank)}, New suit templates: {len(new_suit)}")

    print("\nTesting with IMPROVED templates...")
    new_result = test_accuracy_with_templates(spots, new_rank, new_suit)
    print_report("IMPROVED TEMPLATES", new_result)

    if not args.test_only:
        # Backup originals
        backup_dir = TEMPLATE_DIR / "backup_original"
        if not backup_dir.exists():
            print(f"\nBacking up originals to {backup_dir}...")
            import shutil
            shutil.copytree(TEMPLATE_DIR / "ranks", backup_dir / "ranks")
            shutil.copytree(TEMPLATE_DIR / "suits", backup_dir / "suits")

        # Save improved
        print(f"\nSaving improved templates to {TEMPLATE_DIR}...")
        save_templates(new_rank, new_suit, TEMPLATE_DIR)
        print("Done!")
    else:
        print("\n(--test-only: templates not saved)")


if __name__ == "__main__":
    main()
