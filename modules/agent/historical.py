from __future__ import annotations

import logging
import sqlite3
from typing import Any, Dict, Optional

from .models import GameState

log = logging.getLogger(__name__)

# Map actions_real.type_name values to agent action names.
_ACTION_MAP = {
    "Folds": "FOLD",
    "Checks": "CHECK",
    "Calls": "CALL",
    "Raises": "RAISE",
    "Bets": "RAISE",
    "All-in": "PUSH",
    "All-In": "PUSH",
    "Raises All-In": "PUSH",
    "Bets All-In": "PUSH",
}

# Blind/ante type_ids to exclude (not real decisions).
_BLIND_TYPE_IDS = {1, 2, 15}


def _table_exists(conn: sqlite3.Connection, table: str) -> bool:
    cur = conn.execute(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (table,)
    )
    return cur.fetchone() is not None


def _normalize_action(type_name: str) -> str:
    return _ACTION_MAP.get(type_name, type_name.upper())


def query_historical_action(
    conn: sqlite3.Connection,
    state: GameState,
    *,
    se_tolerance: float = 3.0,
    min_samples: int = 3,
    max_results: int = 200,
) -> Optional[Dict[str, Any]]:
    """Query hands + actions_real for similar historical spots.

    Returns None if not enough data. Otherwise returns:
        {"action": str, "action_counts": dict, "total_samples": int,
         "avg_bet_bb": float, "confidence": float}
    """
    if not _table_exists(conn, "spots_xml_real"):
        log.debug("spots_xml_real table not found, skipping historical")
        return None

    if not _table_exists(conn, "actions_real"):
        log.debug("actions_real table not found, skipping historical")
        return None

    # Step 1: Find hand_ids with matching position + SE from spots_xml_real.
    try:
        cur = conn.execute(
            """
            SELECT sxr.hand_id, hr.hero, hr.hero_cards, hr.bb
            FROM spots_xml_real sxr
            JOIN hands hr ON hr.id = sxr.hand_id
            WHERE sxr.street = 'preflop'
              AND sxr.spot_index = 0
              AND sxr.hero_position = ?
              AND sxr.effective_stack_bb IS NOT NULL
              AND ABS(sxr.effective_stack_bb - ?) <= ?
            LIMIT ?
            """,
            (
                state.hero_pos.upper(),
                state.p1_se_bb,
                se_tolerance,
                max_results * 3,  # fetch more, will filter by hand_class
            ),
        )
        candidates = cur.fetchall()
    except sqlite3.OperationalError as e:
        log.debug("historical query failed: %s", e)
        return None

    if not candidates:
        return None

    # Step 2: Filter by hand_class.
    from modules.preflop.link_hands_obs_to_spots_xml_real import cards_to_hand_class

    matching_hands = []
    for row in candidates:
        hc = cards_to_hand_class(row["hero_cards"] or "")
        if hc == state.hand_class:
            matching_hands.append(row)
        if len(matching_hands) >= max_results:
            break

    if len(matching_hands) < min_samples:
        return None

    # Step 3: Get hero's first non-blind preflop action for each hand.
    hand_ids = [r["hand_id"] for r in matching_hands]
    hero_map = {r["hand_id"]: r["hero"] for r in matching_hands}
    bb_map = {r["hand_id"]: float(r["bb"] or 1) for r in matching_hands}

    placeholders = ",".join("?" for _ in hand_ids)
    actions_rows = conn.execute(
        f"""
        SELECT hand_id, player, type_id, type_name, sum_bb
        FROM actions_real
        WHERE hand_id IN ({placeholders})
          AND round_no = 1
        ORDER BY hand_id, action_no ASC
        """,
        hand_ids,
    ).fetchall()

    # Group by hand_id, pick hero's first non-blind action.
    action_counts: Dict[str, int] = {}
    bet_sum = 0.0
    bet_count = 0
    total = 0

    seen_hands = set()
    for row in actions_rows:
        hid = row["hand_id"]
        if hid in seen_hands:
            continue
        if row["player"] != hero_map.get(hid):
            continue
        if row["type_id"] in _BLIND_TYPE_IDS:
            continue

        seen_hands.add(hid)
        action = _normalize_action(row["type_name"] or "")
        action_counts[action] = action_counts.get(action, 0) + 1
        total += 1

        if action in ("RAISE", "PUSH") and row["sum_bb"]:
            bb = bb_map.get(hid, 1.0)
            bet_bb = float(row["sum_bb"]) / bb if bb > 0 else 0.0
            bet_sum += bet_bb
            bet_count += 1

    if total < min_samples:
        return None

    # Step 4: Pick the most frequent action and compute confidence.
    top_action = max(action_counts, key=lambda k: action_counts[k])
    dominance = action_counts[top_action] / total
    sample_factor = min(total / 20.0, 1.0)
    confidence = 0.3 + 0.4 * dominance * sample_factor

    avg_bet_bb = (bet_sum / bet_count) if bet_count > 0 else 0.0

    return {
        "action": top_action,
        "action_counts": action_counts,
        "total_samples": total,
        "avg_bet_bb": round(avg_bet_bb, 1),
        "confidence": round(confidence, 3),
    }
