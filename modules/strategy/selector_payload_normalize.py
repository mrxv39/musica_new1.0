# C:\Users\Usuario\Desktop\proyectos\poker_boss\modules\strategy\selector_payload_normalize.py
from __future__ import annotations

from typing import Any, Dict


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
