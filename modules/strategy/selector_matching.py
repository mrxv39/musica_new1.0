# C:\Users\Usuario\Desktop\proyectos\poker_boss\modules\strategy\selector_matching.py
from __future__ import annotations

import sqlite3
from typing import Optional, Tuple

from .selector_models import MatchInput, SubStrategySpec
from .selector_spec_parser import parse_spec_from_row
from .selector_matchers import match_categorical, match_numeric


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
