# C:\Users\Usuario\Desktop\proyectos\poker_boss\modules\ocr\stacks_quantize.py
# Post-OCR sanity check for stacks using tournament context.
#
# Tournament rules (Champion Poker Sit & Go 3-max):
#   - 3 players, each starts with 500 chips
#   - Blinds start at 10/20 → starting stack = 25BB
#   - Total chips at table = 75BB (conserved throughout)
#
# This module corrects decimal-shift errors that the raw OCR produces
# (e.g. "245" parsed as 245.0 instead of 24.5).

from __future__ import annotations

import logging
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)

# Tournament constants
NUM_PLAYERS = 3
STARTING_CHIPS = 500
STARTING_BB = 20
STARTING_STACK_BB = STARTING_CHIPS / STARTING_BB  # 25.0
TOTAL_CHIPS_BB = NUM_PLAYERS * STARTING_STACK_BB   # 75.0

# Max any single stack can be (won all chips)
MAX_STACK_BB = TOTAL_CHIPS_BB  # 75.0
# Min reasonable stack (less than this = probably busted or error)
MIN_STACK_BB = 0.5


def _try_decimal_shift(v: float) -> Optional[float]:
    """Try dividing by 10 or 100 to fix a decimal shift."""
    v10 = v / 10.0
    if MIN_STACK_BB <= v10 <= MAX_STACK_BB:
        return v10
    v100 = v / 100.0
    if MIN_STACK_BB <= v100 <= MAX_STACK_BB:
        return v100
    return None


def quantize_stack(v: float) -> float:
    """Apply sanity check to a single stack value.

    If the value is outside the valid range [MIN_STACK_BB, MAX_STACK_BB],
    attempt decimal shift correction. Returns corrected value or original.
    """
    if v <= 0.0:
        return 0.0

    if v > MAX_STACK_BB:
        corrected = _try_decimal_shift(v)
        if corrected is not None:
            logger.debug("stack %.2f -> %.2f (decimal shift)", v, corrected)
            return corrected
        # Can't fix it — return as-is, downstream will flag it
        return v

    if v < MIN_STACK_BB:
        # Could be 0.25 read as 0.025 — try multiplying
        v10 = v * 10.0
        if MIN_STACK_BB <= v10 <= MAX_STACK_BB:
            logger.debug("stack %.4f -> %.2f (upshift x10)", v, v10)
            return v10
        return v

    return v


def quantize_stacks_result(stacks_result: Dict[str, Any]) -> Dict[str, Any]:
    """Apply sanity checks to the full stacks OCR result dict.

    Mutates and returns the same dict with corrected p1/p2/p3 values.
    Also uses conservation of chips: if 2 stacks are plausible and 1 is not,
    infer the bad one from the total.
    """
    if not isinstance(stacks_result, dict) or not stacks_result.get("ok"):
        return stacks_result

    seats = ("p1", "p2", "p3")

    # Step 1: individual decimal shift correction
    for seat in seats:
        v = stacks_result.get(seat)
        if v is not None and isinstance(v, (int, float)) and v > 0:
            corrected = quantize_stack(float(v))
            if corrected != v:
                stacks_result[seat] = corrected

    # Step 2: conservation check
    # Total chips at table ≈ 75BB (stacks behind + bets already posted)
    # We don't have bets here, so we check stacks-only sum.
    # If sum is way off, try to fix the outlier.
    vals = {}
    for seat in seats:
        v = stacks_result.get(seat)
        if isinstance(v, (int, float)) and v > 0:
            vals[seat] = float(v)

    if len(vals) == 3:
        total = sum(vals.values())
        # Stacks behind (without bets) should be ≤ 75BB.
        # With blinds posted, it's 75 - 1.5 = 73.5BB typically.
        # Allow some tolerance for bets/pots in play.
        if total > MAX_STACK_BB * 1.5:  # > 112.5 — something is clearly wrong
            # Find the stack that's furthest from plausible
            # Try shifting each one and see which gives closest to 75
            best_fix = None
            best_diff = abs(total - TOTAL_CHIPS_BB)
            for seat in seats:
                v = vals[seat]
                shifted = v / 10.0
                if MIN_STACK_BB <= shifted <= MAX_STACK_BB:
                    new_total = total - v + shifted
                    diff = abs(new_total - TOTAL_CHIPS_BB)
                    if diff < best_diff:
                        best_diff = diff
                        best_fix = (seat, shifted)
            if best_fix:
                seat, corrected = best_fix
                logger.debug(
                    "conservation fix: %s %.2f -> %.2f (total was %.1f)",
                    seat, vals[seat], corrected, total,
                )
                stacks_result[seat] = corrected

    return stacks_result
