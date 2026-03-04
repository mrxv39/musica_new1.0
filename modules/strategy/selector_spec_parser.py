# C:\Users\Usuario\Desktop\proyectos\poker_boss\modules\strategy\selector_spec_parser.py
from __future__ import annotations

import sqlite3
from typing import Any, Dict, Optional, Tuple

from .selector_models import SubStrategySpec
from .selector_utils import load_payload

from .selector_payload_normalize import _normalize_payload_flat_to_nested, _normalize_payload_nested_to_flat


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
    if isinstance(payload, dict) and situ_from_db and not str(payload.get("situacion", "") or "").strip():
        payload["situacion"] = situ_from_db

    # DB payload anidado -> plano (para SubStrategySpec.from_payload)
    if isinstance(payload, dict):
        payload = _normalize_payload_nested_to_flat(payload)

    try:
        spec = SubStrategySpec.from_payload(payload)  # type: ignore[arg-type]
        return spec, None
    except ValueError as e:
        return None, f"invalid_payload:{e}"
