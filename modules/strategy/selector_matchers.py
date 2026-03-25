# C:\Users\Usuario\Desktop\proyectos\poker_boss\modules\strategy\selector_matchers.py
from __future__ import annotations

from typing import Optional

from .selector_models import MatchInput, SubStrategySpec
from .selector_utils import norm_lower, norm_upper


def _norm_tipo(v: str) -> str:
    """
    Pool default:
    - Si el rival es desconocido (OCR/DB no lo clasifica), tratamos como 'fish'.
    """
    t = norm_lower(v)
    if t in ("", "unknown", "unk", "?"):
        return "fish"
    return t


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

    if spec.p2_tipo != _norm_tipo(inp.p2_tipo):
        return "p2_tipo"
    if spec.p3_tipo != _norm_tipo(inp.p3_tipo):
        return "p3_tipo"

    return None


def match_numeric(inp: MatchInput, spec: SubStrategySpec) -> Optional[str]:
    """
    Returns mismatch reason for numeric bounds, or None if OK.

    CONTRACT (worker):
      - Filter by stackefectivo (p1_se) + bets (p1_bet/p2_bet/p3_bet)
      - Do NOT use stacks (p1_stack/p2_stack/p3_stack) for matching.
    """
    if not spec.p1_se.contains(inp.p1_se_bb):
        return "p1_se"

    if not spec.p1_bet.contains(inp.p1_bet_bb):
        return "p1_bet"
    if not spec.p2_bet.contains(inp.p2_bet_bb):
        return "p2_bet"
    if not spec.p3_bet.contains(inp.p3_bet_bb):
        return "p3_bet"

    return None
