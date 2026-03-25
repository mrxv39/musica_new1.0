# C:\Users\Usuario\Desktop\proyectos\poker_boss\modules\ocr\bets\bets_correction.py
# Post-OCR bet correction using XML ground truth (actions_real).
#
# Strategy: the hero bet (p1) is usually reliable from OCR.
# We find the preflop action state where hero's cumulative bet matches p1,
# then derive the correct villain bets from that state.

from __future__ import annotations

import json
from typing import Any, Dict, Optional


def correct_bets_via_xml(
    ocr_bets: Dict[str, Any],
    hand_id: int,
    players_json: str,
    conn,
    hero: str = "xavieeee2",
    tolerance: float = 0.5,
) -> Dict[str, Any] | None:
    """
    Try to correct OCR bets using actions_real from the linked XML hand.

    Returns corrected bets dict with same structure as ocr_bets, or None if
    correction is not possible (no hand_id, no actions, p1 doesn't match any state).
    """
    if not hand_id or conn is None:
        return None

    ocr_p1 = float(ocr_bets.get("p1", 0) or 0)

    # Parse player names from XML
    try:
        pj = json.loads(players_json or "{}")
        players = pj if isinstance(pj, list) else pj.get("players", [])
        villain_names = [
            (p.get("name") or "").strip()
            for p in players
            if (p.get("name") or "").strip().lower() != hero.lower()
        ]
    except (json.JSONDecodeError, TypeError):
        return None

    if not villain_names:
        return None

    # Get preflop actions
    try:
        actions = conn.execute(
            "SELECT player, type_name, sum_bb FROM actions_real "
            "WHERE hand_id = ? AND round_no IN (0, 1) ORDER BY action_no",
            (hand_id,),
        ).fetchall()
    except Exception:
        return None

    if not actions:
        return None

    # Build cumulative states at each action step
    cumulative: Dict[str, float] = {}
    candidate_states: list[Dict[str, float]] = []

    for player, action, amount_bb in actions:
        if action in ("POST_SB", "POST_BB", "CALL", "RAISE", "BET"):
            cumulative[player] = cumulative.get(player, 0) + amount_bb

        hero_cum = cumulative.get(hero, 0.0)
        if abs(hero_cum - ocr_p1) <= tolerance:
            candidate_states.append(dict(cumulative))

    if not candidate_states:
        return None

    # Among all states where hero matches, pick the one with the smallest
    # total diff against ALL OCR bets (not just hero)
    ocr_vills = [float(ocr_bets.get("p2", 0) or 0), float(ocr_bets.get("p3", 0) or 0)]

    best_state: Optional[Dict[str, float]] = None
    best_total_diff = 999.0

    for state in candidate_states:
        hero_cum = state.get(hero, 0.0)
        vill_vals = [state.get(vn, 0.0) for vn in villain_names]
        # Pad to match OCR slots
        while len(vill_vals) < len(ocr_vills):
            vill_vals.append(0.0)

        # Compare sorted (OCR p2/p3 order may not match XML player order)
        xml_sorted = sorted(vill_vals, reverse=True)
        ocr_sorted = sorted(ocr_vills, reverse=True)
        total_diff = abs(hero_cum - ocr_p1) + sum(
            abs(a - b) for a, b in zip(xml_sorted, ocr_sorted)
        )

        if total_diff < best_total_diff:
            best_total_diff = total_diff
            best_state = state

    if best_state is None:
        return None

    # Build corrected bets
    corrected_hero = best_state.get(hero, 0.0)
    villain_bets = [best_state.get(vn, 0.0) for vn in villain_names]

    # Map to p2/p3 (same order as in players_json)
    corrected = dict(ocr_bets)
    corrected["p1"] = round(corrected_hero, 2)
    corrected["p2"] = round(villain_bets[0], 2) if len(villain_bets) > 0 else 0.0
    corrected["p3"] = round(villain_bets[1], 2) if len(villain_bets) > 1 else 0.0
    corrected["correction"] = "xml_actions"
    corrected["correction_hero_diff"] = round(abs(corrected_hero - ocr_p1), 3)

    return corrected
