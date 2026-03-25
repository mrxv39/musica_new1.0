from __future__ import annotations

import logging
import sqlite3
from typing import Optional

from modules.strategy.spot_strategy_engine import SpotDecisionInput, decide_spot_strategy

from .historical import query_historical_action
from .models import AgentDecision, GameState

log = logging.getLogger(__name__)


def decide(state: GameState, conn: Optional[sqlite3.Connection] = None) -> AgentDecision:
    """Main entry point: decide what action to take given a game state.

    1. Try the strategy engine (spots_strategies / nash tables).
    2. If no match, fall back to historical hands + actions_real.
    3. If nothing, default FOLD with confidence 0.
    """
    own_conn = False
    if conn is None:
        from modules.db.conn import get_conn

        conn = get_conn()
        own_conn = True

    try:
        decision = _try_strategy_engine(conn, state)
        if decision is not None:
            return decision

        decision = _try_historical(conn, state)
        if decision is not None:
            return decision

        return AgentDecision(
            action="FOLD",
            confidence=0.0,
            source="default_fold",
            details={"reason": "no_strategy_no_history"},
        )
    finally:
        if own_conn:
            conn.close()


def _try_strategy_engine(conn: sqlite3.Connection, state: GameState) -> Optional[AgentDecision]:
    """Try the strategy engine. Returns None if no usable match."""
    try:
        inp = SpotDecisionInput(
            spot_key=state.hero_pos,
            hand_class=state.hand_class,
            p1_se_bb=state.p1_se_bb,
            p1_bet_bb=state.p1_bet_bb,
            p2_pos=state.p2_pos,
            p3_pos=state.p3_pos,
            p2_tipo=state.p2_tipo,
            p3_tipo=state.p3_tipo,
        )
        result = decide_spot_strategy(conn, inp)
    except (ValueError, Exception) as e:
        log.debug("strategy engine raised: %s", e)
        return None

    if not result.get("ok"):
        return None

    move = str(result.get("move") or "FOLD").upper()
    bet_min = float(result.get("betmin") or 0)
    bet_max = float(result.get("betmax") or 0)
    sheet = str(result.get("sheet") or "")

    # Determine confidence based on source
    if "nash" in sheet.lower():
        confidence = 0.8
    else:
        confidence = 1.0

    # Distinguish explicit strategy FOLD from "hand not in any range" FOLD.
    # _fold_no_strategy_row returns ok=True but no spot_strategy_id.
    has_strategy_id = result.get("spot_strategy_id") is not None
    if move == "FOLD" and not has_strategy_id:
        # Hand not in any defined range — fall through to historical.
        return None

    return AgentDecision(
        action=move,
        bet_min=bet_min,
        bet_max=bet_max,
        confidence=confidence,
        source="strategy_engine",
        details={
            "sheet": sheet,
            "spot_strategy_id": result.get("spot_strategy_id"),
            "situacion": f"{state.hero_pos}_vs_{state.p2_pos}_{state.p3_pos}_{state.p2_tipo}_{state.p3_tipo}",
        },
    )


def _try_historical(conn: sqlite3.Connection, state: GameState) -> Optional[AgentDecision]:
    """Try historical data fallback."""
    try:
        hist = query_historical_action(conn, state)
    except Exception as e:
        log.debug("historical query failed: %s", e)
        return None

    if hist is None:
        return None

    return AgentDecision(
        action=hist["action"],
        bet_min=hist.get("avg_bet_bb", 0.0),
        bet_max=hist.get("avg_bet_bb", 0.0),
        confidence=hist["confidence"],
        source="historical",
        details={
            "total_samples": hist["total_samples"],
            "action_counts": hist["action_counts"],
        },
    )
