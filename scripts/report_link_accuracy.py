"""Report: accuracy of OCR (mano, stacks, bets) vs imported XML hands.

Usage:
    python scripts/report_link_accuracy.py
    python scripts/report_link_accuracy.py --db data/poker_boss.db
"""
from __future__ import annotations

import argparse
import json
import sqlite3
import sys
from typing import Any, Dict, List, Optional, Tuple

DEFAULT_DB = r"C:\Users\Usuario\Desktop\proyectos\poker_boss\data\poker_boss.db"

RANK_ORDER = "23456789TJQKA"
RANK_VALUE = {r: i for i, r in enumerate(RANK_ORDER)}


def _norm_rank(x: str) -> str:
    x = (x or "").strip().upper()
    if x in ("10", "1"):
        return "T"
    return x[:1]


def _parse_card(tok: str) -> Optional[Tuple[str, str]]:
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


def _split_cards(raw: str) -> List[str]:
    s = (raw or "").strip()
    if not s:
        return []
    if " " in s:
        return [x for x in s.split() if x]
    if len(s) == 4:
        return [s[:2], s[2:]]
    if len(s) == 6:
        return [s[:3], s[3:]]
    return [s]


def hand_class(raw: str) -> str:
    toks = _split_cards(raw)
    if len(toks) != 2:
        return ""
    c1 = _parse_card(toks[0])
    c2 = _parse_card(toks[1])
    if not c1 or not c2:
        return ""
    r1, s1 = c1
    r2, s2 = c2
    if RANK_VALUE.get(r1, -1) < RANK_VALUE.get(r2, -1):
        r1, r2 = r2, r1
        s1, s2 = s2, s1
    if r1 == r2:
        return f"{r1}{r2}"
    return f"{r1}{r2}{'s' if s1 == s2 else 'o'}"


def _safe_float(v: Any) -> Optional[float]:
    try:
        if v is None or v == "":
            return None
        return float(v)
    except Exception:
        return None


def _extract_xml_stacks_bb(players_json: str, hero_name: str, bb: float) -> Optional[Dict[str, float]]:
    if not bb or bb <= 0:
        return None
    try:
        data = json.loads(players_json or "{}")
    except Exception:
        return None
    players = data.get("players", [])
    if len(players) < 2:
        return None
    result: Dict[str, float] = {}
    hero_found = False
    vi = 1
    for p in players:
        chips = _safe_float(p.get("chips"))
        if chips is None:
            continue
        stack_bb = chips / bb
        name = str(p.get("name", ""))
        if name == hero_name and not hero_found:
            result["p1"] = round(stack_bb, 2)
            hero_found = True
        else:
            result[f"p{vi + 1}"] = round(stack_bb, 2)
            vi += 1
    return result if hero_found else None


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", default=DEFAULT_DB)
    ap.add_argument("--verbose", "-v", action="store_true")
    args = ap.parse_args()

    con = sqlite3.connect(args.db)
    con.row_factory = sqlite3.Row

    rows = con.execute("""
        SELECT
            s.obs_id,
            s.mano_raw,
            s.hand_class AS ocr_hand_class,
            s.captured_gamecode,
            s.ocr_json,
            h.id AS hand_id,
            h.hero_cards,
            h.bb,
            h.hero,
            h.players_json
        FROM spots s
        JOIN hands h ON h.id = s.linked_hand_id
        ORDER BY s.obs_id
    """).fetchall()

    con.close()

    if not rows:
        print("No linked spots found.")
        return 0

    # --- Mano accuracy ---
    mano_total = 0
    mano_match = 0
    mano_mismatch: List[Dict[str, Any]] = []

    # --- Stacks accuracy ---
    stacks_total = 0
    stacks_errors: List[Dict[str, Any]] = []
    stacks_abs_diffs: List[float] = []

    # --- Bets accuracy ---
    bets_total = 0
    bets_errors: List[Dict[str, Any]] = []

    for r in rows:
        ocr_hc = r["ocr_hand_class"] or hand_class(r["mano_raw"] or "")
        xml_hc = hand_class(r["hero_cards"] or "")

        # -- Mano --
        if ocr_hc and xml_hc:
            mano_total += 1
            if ocr_hc == xml_hc:
                mano_match += 1
            else:
                mano_mismatch.append({
                    "obs_id": r["obs_id"],
                    "gamecode": r["captured_gamecode"],
                    "ocr": ocr_hc,
                    "xml": xml_hc,
                    "ocr_raw": r["mano_raw"],
                    "xml_raw": r["hero_cards"],
                })

        # -- Stacks --
        try:
            ocr_data = json.loads(r["ocr_json"] or "{}")
        except Exception:
            ocr_data = {}

        ocr_stacks = ocr_data.get("ocr", {}).get("stacks", {})
        xml_stacks = _extract_xml_stacks_bb(
            r["players_json"], r["hero"], r["bb"]
        )

        if xml_stacks and ocr_stacks:
            ocr_p1 = _safe_float(ocr_stacks.get("p1"))
            xml_p1 = xml_stacks.get("p1")
            if ocr_p1 is not None and xml_p1 is not None:
                stacks_total += 1
                diff = abs(ocr_p1 - xml_p1)
                stacks_abs_diffs.append(diff)
                if diff > 2.0:
                    stacks_errors.append({
                        "obs_id": r["obs_id"],
                        "gamecode": r["captured_gamecode"],
                        "ocr_p1": ocr_p1,
                        "xml_p1": xml_p1,
                        "diff": round(diff, 2),
                    })

    # ==================== PRINT REPORT ====================
    print("=" * 64)
    print("  LINK ACCURACY REPORT")
    print("=" * 64)
    print(f"  Linked spots: {len(rows)}")
    print()

    # -- Mano --
    print("-" * 40)
    print("  MANO (hand class)")
    print("-" * 40)
    if mano_total:
        pct = mano_match / mano_total * 100
        print(f"  Compared:  {mano_total}")
        print(f"  Match:     {mano_match}  ({pct:.1f}%)")
        print(f"  Mismatch:  {len(mano_mismatch)}")
        if mano_mismatch:
            print()
            print(f"  {'obs_id':>7}  {'gamecode':>14}  {'OCR':>6}  {'XML':>6}  OCR_raw -> XML_raw")
            for m in mano_mismatch[:20]:
                print(f"  {m['obs_id']:>7}  {m['gamecode']:>14}  {m['ocr']:>6}  {m['xml']:>6}  {m['ocr_raw']} -> {m['xml_raw']}")
            if len(mano_mismatch) > 20:
                print(f"  ... and {len(mano_mismatch) - 20} more")
    else:
        print("  No comparable data.")
    print()

    # -- Stacks --
    print("-" * 40)
    print("  STACKS (hero p1, in BB)")
    print("-" * 40)
    if stacks_total:
        avg_diff = sum(stacks_abs_diffs) / len(stacks_abs_diffs)
        max_diff = max(stacks_abs_diffs)
        exact = sum(1 for d in stacks_abs_diffs if d < 0.5)
        close = sum(1 for d in stacks_abs_diffs if d <= 2.0)
        print(f"  Compared:    {stacks_total}")
        print(f"  Exact (<0.5 BB diff):  {exact}  ({exact/stacks_total*100:.1f}%)")
        print(f"  Close (<=2 BB diff):   {close}  ({close/stacks_total*100:.1f}%)")
        print(f"  Avg diff:    {avg_diff:.2f} BB")
        print(f"  Max diff:    {max_diff:.2f} BB")
        if stacks_errors:
            print()
            print(f"  Outliers (>2 BB diff): {len(stacks_errors)}")
            print(f"  {'obs_id':>7}  {'gamecode':>14}  {'OCR':>8}  {'XML':>8}  {'diff':>6}")
            for e in stacks_errors[:15]:
                print(f"  {e['obs_id']:>7}  {e['gamecode']:>14}  {e['ocr_p1']:>8.1f}  {e['xml_p1']:>8.1f}  {e['diff']:>6.1f}")
            if len(stacks_errors) > 15:
                print(f"  ... and {len(stacks_errors) - 15} more")
    else:
        print("  No comparable data.")
    print()

    # -- Summary --
    print("=" * 64)
    if mano_total:
        print(f"  Mano accuracy:   {mano_match}/{mano_total} ({mano_match/mano_total*100:.1f}%)")
    if stacks_total:
        exact = sum(1 for d in stacks_abs_diffs if d < 0.5)
        print(f"  Stacks accuracy: {exact}/{stacks_total} ({exact/stacks_total*100:.1f}%) exact")
    print("=" * 64)

    return 0


if __name__ == "__main__":
    sys.exit(main())
