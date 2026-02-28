# C:\Users\Usuario\Desktop\proyectos\poker_boss\modules\strategy\selector_matching.py
from __future__ import annotations

import sqlite3
from typing import Any, Dict, Optional, Tuple

from .selector_models import MatchInput, SubStrategySpec
from .selector_utils import load_payload, norm_lower, norm_upper


def parse_spec_from_row(row: sqlite3.Row) -> Tuple[Optional[SubStrategySpec], Optional[str]]:
    """
    Returns (spec, error_reason_if_any).
    If invalid payload => (None, "invalid_payload:...").
    """
    payload = load_payload(row)
    try:
        spec = SubStrategySpec.from_payload(payload)
        return spec, None
    except ValueError as e:
        return None, f"invalid_payload:{e}"


def match_categorical(inp: MatchInput, spec: SubStrategySpec) -> Optional[str]:
    """
    Returns mismatch reason for categorical fields, or None if OK.
    """
    if spec.spot != norm_upper(inp.spot):
        return "spot"
    if spec.hero_pos != norm_upper(inp.hero_pos):
        return "hero_pos"

    if spec.p2_pos != norm_upper(inp.p2_pos):
        return "p2_pos"
    if spec.p3_pos != norm_upper(inp.p3_pos):
        return "p3_pos"

    if spec.p2_tipo != norm_lower(inp.p2_tipo):
        return "p2_tipo"
    if spec.p3_tipo != norm_lower(inp.p3_tipo):
        return "p3_tipo"

    return None


def match_numeric(inp: MatchInput, spec: SubStrategySpec) -> Optional[str]:
    """
    Returns mismatch reason for numeric bounds, or None if OK.
    """
    if not spec.p1_bet.contains(inp.p1_bet_bb):
        return "p1_bet"
    if not spec.p1_stack.contains(inp.p1_stack_bb):
        return "p1_stack"
    if not spec.p1_se.contains(inp.p1_se_bb):
        return "p1_se"

    if not spec.p2_bet.contains(inp.p2_bet_bb):
        return "p2_bet"
    if not spec.p2_stack.contains(inp.p2_stack_bb):
        return "p2_stack"

    if not spec.p3_bet.contains(inp.p3_bet_bb):
        return "p3_bet"
    if not spec.p3_stack.contains(inp.p3_stack_bb):
        return "p3_stack"

    return None


def match_row_strict(inp: MatchInput, row: sqlite3.Row) -> Tuple[bool, str, Optional[SubStrategySpec]]:
    """
    STRICT MATCHING:
    - No wildcards.
    - Any missing/None/empty required field => row does NOT match.
    - Numeric min/max MUST exist (no None). If you want open ranges, define them explicitly.

    Returns:
      (ok, reason, spec_or_none)
    """
    spec, err = parse_spec_from_row(row)
    if err:
        return False, err, None

    assert spec is not None
    reason = match_categorical(inp, spec)
    if reason:
        return False, reason, spec

    reason = match_numeric(inp, spec)
    if reason:
        return False, reason, spec

    return True, "ok", spec