# C:\Users\Usuario\Desktop\proyectos\poker_boss\modules\strategy\selector_matching.py
from __future__ import annotations

import sqlite3
from typing import Any, Dict, Optional, Tuple

from .selector_models import MatchInput, SubStrategySpec
from .selector_utils import load_payload, norm_lower, norm_upper


def _normalize_payload_flat_to_nested(payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Compat layer:
    - Tests legacy guardan payload "plano" (p2_pos, p2_tipo, p1_bet_min, etc.).
    - Runtime nuevo puede guardar payload anidado (p2:{pos,tipo,...}, p1:{bet_min,...}).

    Regla: si YA existen p1/p2/p3 como dict, no machacamos.
    Si no existen, pero hay claves planas, construimos p1/p2/p3.
    """

    def f(key: str, default: Any = "") -> Any:
        v = payload.get(key, default)
        return default if v is None else v

    # p1
    if not isinstance(payload.get("p1"), dict):
        has_any_p1 = any(k in payload for k in ("p1_bet_min", "p1_bet_max", "p1_stack_min", "p1_stack_max", "p1_se_min", "p1_se_max"))
        if has_any_p1:
            payload["p1"] = {
                "bet_min": f("p1_bet_min", 0),
                "bet_max": f("p1_bet_max", 0),
                "st_min": f("p1_stack_min", 0),
                "st_max": f("p1_stack_max", 0),
                "se_min": f("p1_se_min", 0),
                "se_max": f("p1_se_max", 0),
            }

    # p2
    if not isinstance(payload.get("p2"), dict):
        has_any_p2 = any(k in payload for k in ("p2_pos", "p2_tipo", "p2_bet_min", "p2_bet_max", "p2_stack_min", "p2_stack_max"))
        if has_any_p2:
            payload["p2"] = {
                "pos": f("p2_pos", ""),
                "tipo": f("p2_tipo", ""),
                "bet_min": f("p2_bet_min", 0),
                "bet_max": f("p2_bet_max", 0),
                "st_min": f("p2_stack_min", 0),
                "st_max": f("p2_stack_max", 0),
            }

    # p3
    if not isinstance(payload.get("p3"), dict):
        has_any_p3 = any(k in payload for k in ("p3_pos", "p3_tipo", "p3_bet_min", "p3_bet_max", "p3_stack_min", "p3_stack_max"))
        if has_any_p3:
            payload["p3"] = {
                "pos": f("p3_pos", ""),
                "tipo": f("p3_tipo", ""),
                "bet_min": f("p3_bet_min", 0),
                "bet_max": f("p3_bet_max", 0),
                "st_min": f("p3_stack_min", 0),
                "st_max": f("p3_stack_max", 0),
            }

    return payload


def _normalize_payload_nested_to_flat(payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    DB real usa payload ANIDADO:
      p1:{bet_min,bet_max,st_min,st_max,se_min,se_max}
      p2:{pos,tipo,bet_min,bet_max,st_min,st_max}
      p3:{pos,tipo,bet_min,bet_max,st_min,st_max}
      hero_pos
    Pero SubStrategySpec.from_payload() hoy espera formato PLANO:
      spot, hero_pos, p2_pos, p2_tipo, ...
      p1_bet_min, p1_bet_max, p1_stack_min, p1_stack_max, p1_se_min, p1_se_max
      p2_bet_min, ...
    Regla: si ya existe clave plana, no machacamos.
    """

    def put_if_missing(k: str, v: Any) -> None:
        if k not in payload:
            payload[k] = v

    p1 = payload.get("p1") if isinstance(payload.get("p1"), dict) else {}
    p2 = payload.get("p2") if isinstance(payload.get("p2"), dict) else {}
    p3 = payload.get("p3") if isinstance(payload.get("p3"), dict) else {}

    # spot: en tu DB no existe "spot" en payload; lo derivamos de hero_pos (BTN/SB/BB)
    spot_val = payload.get("spot")
    if not isinstance(spot_val, str) or not spot_val.strip():
        hp = payload.get("hero_pos")
        if isinstance(hp, str) and hp.strip():
            payload["spot"] = hp.strip()

    # p1 bounds
    put_if_missing("p1_bet_min", p1.get("bet_min"))
    put_if_missing("p1_bet_max", p1.get("bet_max"))
    put_if_missing("p1_stack_min", p1.get("st_min"))
    put_if_missing("p1_stack_max", p1.get("st_max"))
    put_if_missing("p1_se_min", p1.get("se_min"))
    put_if_missing("p1_se_max", p1.get("se_max"))

    # p2 categorical + bounds
    put_if_missing("p2_pos", p2.get("pos"))
    put_if_missing("p2_tipo", p2.get("tipo"))
    put_if_missing("p2_bet_min", p2.get("bet_min"))
    put_if_missing("p2_bet_max", p2.get("bet_max"))
    put_if_missing("p2_stack_min", p2.get("st_min"))
    put_if_missing("p2_stack_max", p2.get("st_max"))

    # p3 categorical + bounds
    put_if_missing("p3_pos", p3.get("pos"))
    put_if_missing("p3_tipo", p3.get("tipo"))
    put_if_missing("p3_bet_min", p3.get("bet_min"))
    put_if_missing("p3_bet_max", p3.get("bet_max"))
    put_if_missing("p3_stack_min", p3.get("st_min"))
    put_if_missing("p3_stack_max", p3.get("st_max"))

    return payload


def parse_spec_from_row(row: sqlite3.Row) -> Tuple[Optional[SubStrategySpec], Optional[str]]:
    """
    Returns (spec, error_reason_if_any).
    If invalid payload => (None, "invalid_payload:...").
    """
    payload = load_payload(row)

    # Compat: payload plano -> payload anidado (solo si falta p1/p2/p3)
    if isinstance(payload, dict):
        payload = _normalize_payload_flat_to_nested(payload)

    # Inyecta 'situacion' desde DB (spots.name) si falta en payload_json
    try:
        rowd = dict(row)
    except Exception:
        rowd = {}
    situ_from_db = str(rowd.get("situation_key", "") or "")
    if situ_from_db and not str(payload.get("situacion", "") or "").strip():
        payload["situacion"] = situ_from_db

    # DB payload anidado -> plano (para SubStrategySpec.from_payload)
    if isinstance(payload, dict):
        payload = _normalize_payload_nested_to_flat(payload)

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

