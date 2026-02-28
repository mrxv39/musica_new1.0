# C:\Users\Usuario\Desktop\proyectos\poker_boss\modules\strategy\selector_models.py
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict


@dataclass(frozen=True)
class MatchInput:
    """
    IMPORTANT:
    - p1_stack_bb: stack del héroe en BB (si lo usas)
    - p1_se_bb: stack efectivo del spot (en BB). En tu caso viene por OCR (stackefectivo).
      Si OCR se equivoca y cae fuera de rango, NO matchea (en strict).
    """
    spot: str
    hero_pos: str

    p1_bet_bb: float
    p1_stack_bb: float
    p1_se_bb: float

    p2_pos: str
    p2_tipo: str
    p2_bet_bb: float
    p2_stack_bb: float

    p3_pos: str
    p3_tipo: str
    p3_bet_bb: float
    p3_stack_bb: float

    hand_class: str
    situacion: str  # NOT used for filtering in strict mode (only for debug/context)


@dataclass(frozen=True)
class Bounds:
    lo: float
    hi: float

    def contains(self, x: float) -> bool:
        return float(self.lo) <= float(x) <= float(self.hi)

    def distance_to_interval(self, x: float) -> float:
        """
        0 if inside, otherwise distance to nearest bound.
        Example: interval [20, 75], x=18 => 2. x=80 => 5.
        """
        x = float(x)
        if self.contains(x):
            return 0.0
        if x < float(self.lo):
            return float(self.lo) - x
        return x - float(self.hi)

    def __str__(self) -> str:
        return f"[{self.lo}, {self.hi}]"


@dataclass(frozen=True)
class SubStrategySpec:
    """
    Spec estricto parseado desde payload_json.
    Si el payload está incompleto/mal, el spec es inválido y esa row NO puede matchear.
    """
    spot: str
    hero_pos: str

    p2_pos: str
    p3_pos: str
    p2_tipo: str
    p3_tipo: str

    p1_bet: Bounds
    p1_stack: Bounds
    p1_se: Bounds

    p2_bet: Bounds
    p2_stack: Bounds

    p3_bet: Bounds
    p3_stack: Bounds

    @staticmethod
    def from_payload(payload: Dict[str, Any]) -> "SubStrategySpec":
        from .selector_utils import req_float, req_str  # local import to avoid cycles

        # strings required
        spot = req_str(payload, "spot").upper()
        hero_pos = req_str(payload, "hero_pos").upper()
        p2_pos = req_str(payload, "p2_pos").upper()
        p3_pos = req_str(payload, "p3_pos").upper()
        p2_tipo = req_str(payload, "p2_tipo").lower()
        p3_tipo = req_str(payload, "p3_tipo").lower()

        # numeric bounds required (min/max)
        p1_bet = Bounds(req_float(payload, "p1_bet_min"), req_float(payload, "p1_bet_max"))
        p1_stack = Bounds(req_float(payload, "p1_stack_min"), req_float(payload, "p1_stack_max"))
        p1_se = Bounds(req_float(payload, "p1_se_min"), req_float(payload, "p1_se_max"))

        p2_bet = Bounds(req_float(payload, "p2_bet_min"), req_float(payload, "p2_bet_max"))
        p2_stack = Bounds(req_float(payload, "p2_stack_min"), req_float(payload, "p2_stack_max"))

        p3_bet = Bounds(req_float(payload, "p3_bet_min"), req_float(payload, "p3_bet_max"))
        p3_stack = Bounds(req_float(payload, "p3_stack_min"), req_float(payload, "p3_stack_max"))

        return SubStrategySpec(
            spot=spot,
            hero_pos=hero_pos,
            p2_pos=p2_pos,
            p3_pos=p3_pos,
            p2_tipo=p2_tipo,
            p3_tipo=p3_tipo,
            p1_bet=p1_bet,
            p1_stack=p1_stack,
            p1_se=p1_se,
            p2_bet=p2_bet,
            p2_stack=p2_stack,
            p3_bet=p3_bet,
            p3_stack=p3_stack,
        )