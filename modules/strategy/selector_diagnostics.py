# C:\Users\Usuario\Desktop\proyectos\poker_boss\modules\strategy\selector_diagnostics.py
from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Iterable, List, Tuple

import sqlite3

from .selector_models import Bounds, MatchInput, SubStrategySpec
from .selector_matching import match_categorical
from .selector_utils import load_payload


@dataclass(frozen=True)
class NearMiss:
    """
    A row that matches all categorical fields, but fails numeric bounds in some field.
    We mainly use this to explain SE failures and to support fallback selection.
    """
    row_id: int
    name: str
    situation_key: str
    failed_field: str
    value: float
    bounds: Bounds
    distance: float


def collect_reasons_stats(reasons: Dict[str, int], limit: int = 10) -> List[Tuple[str, int]]:
    return sorted(reasons.items(), key=lambda kv: kv[1], reverse=True)[:limit]


def rows_matching_categorical(
    inp: MatchInput,
    rows_with_specs: Iterable[Tuple[sqlite3.Row, SubStrategySpec]],
) -> List[Tuple[sqlite3.Row, SubStrategySpec]]:
    out: List[Tuple[sqlite3.Row, SubStrategySpec]] = []
    for row, spec in rows_with_specs:
        if match_categorical(inp, spec) is None:
            out.append((row, spec))
    return out


def collect_near_misses_bounds_field(
    field: str,
    inp_value: float,
    candidates: Iterable[Tuple[sqlite3.Row, SubStrategySpec]],
) -> List[NearMiss]:
    out: List[NearMiss] = []
    for row, spec in candidates:
        bounds = getattr(spec, field, None)
        if not isinstance(bounds, Bounds):
            continue
        dist = bounds.distance_to_interval(inp_value)
        if dist <= 0:
            continue
        out.append(
            NearMiss(
                row_id=int(row["id"]),
                name=str(row["name"]),
                situation_key=str(row["situation_key"]),
                failed_field=field,
                value=float(inp_value),
                bounds=bounds,
                distance=float(dist),
            )
        )
    out.sort(key=lambda m: (m.distance, m.row_id))
    return out


def format_top_near_misses(misses: List[NearMiss], limit: int = 5) -> str:
    if not misses:
        return "[]"
    cut = misses[:limit]
    parts = []
    for m in cut:
        parts.append(
            f"(id={m.row_id},name={m.name},sit={m.situation_key},val={m.value},bounds={m.bounds},dist={m.distance})"
        )
    return "[" + ", ".join(parts) + "]"


def build_failure_error_message(
    inp: MatchInput,
    matches: List[Tuple[sqlite3.Row, Dict]],
    reasons: Dict[str, int],
    rows_with_specs: List[Tuple[sqlite3.Row, SubStrategySpec]],
    fallback_se_enabled: bool,
) -> str:
    ids = [int(m[0]["id"]) for m in matches]
    keys = [str(m[0]["situation_key"]) for m in matches]
    top_reasons = collect_reasons_stats(reasons)

    cat_matched = rows_matching_categorical(inp, rows_with_specs)

    se_misses = collect_near_misses_bounds_field("p1_se", inp.p1_se_bb, cat_matched)
    stack_misses = collect_near_misses_bounds_field("p1_stack", inp.p1_stack_bb, cat_matched)
    bet_misses = collect_near_misses_bounds_field("p1_bet", inp.p1_bet_bb, cat_matched)

    return (
        "Expected exactly 1 match, got "
        f"{len(matches)}. matched_ids={ids}. matched_situations={keys}. "
        f"top_nonmatch_reasons={top_reasons}. requested_situacion={inp.situacion!r}. "
        f"near_miss_p1_se={format_top_near_misses(se_misses)}. "
        f"near_miss_p1_stack={format_top_near_misses(stack_misses)}. "
        f"near_miss_p1_bet={format_top_near_misses(bet_misses)}. "
        f"fallback_se_enabled={fallback_se_enabled}"
    )