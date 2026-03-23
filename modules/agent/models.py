from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict


@dataclass(frozen=True)
class GameState:
    """Snapshot of a single preflop decision point, as seen by the worker."""

    # Hero hand
    hand_class: str  # e.g. "AKs", "77"

    # Positions (p1=hero always)
    hero_pos: str  # "BTN", "SB", "BB"
    p2_pos: str
    p3_pos: str

    # Villain types
    p2_tipo: str  # "FISH", "REG", "UNKNOWN"
    p3_tipo: str

    # Stacks & bets in BB
    p1_stack_bb: float
    p1_bet_bb: float  # hero bet already committed
    p1_se_bb: float  # effective stack

    p2_stack_bb: float
    p2_bet_bb: float
    p3_stack_bb: float
    p3_bet_bb: float

    # Optional metadata
    mesa: int = 0
    image_path: str = ""


@dataclass
class AgentDecision:
    """What the agent recommends."""

    action: str  # "FOLD", "CALL", "RAISE", "PUSH", "CHECK"
    bet_min: float = 0.0
    bet_max: float = 0.0
    confidence: float = 0.0  # 0.0-1.0

    source: str = "default_fold"  # "strategy_engine", "historical", "default_fold"
    details: Dict[str, Any] = field(default_factory=dict)
