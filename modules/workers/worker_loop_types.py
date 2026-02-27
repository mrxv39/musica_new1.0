# C:\Users\Usuario\Desktop\proyectos\poker_boss\modules\workers\worker_loop_types.py
from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Dict, List, Optional


def _ms(dt_s: float) -> float:
    return round(dt_s * 1000.0, 2)


@dataclass
class LoopConfig:
    worker_id: int
    interval_ms: int
    image_path: Optional[str]
    images_dir: Optional[str]
    loop_dir: bool
    region: Optional[List[int]]
    max_ticks: Optional[int]
    print_every_tick: bool
    persist_without_stack: bool


@dataclass
class ReplayDirState:
    files: List[str] = field(default_factory=list)
    idx: int = 0


@dataclass
class ImageGrabResult:
    img_path: Optional[str]
    image_ref: str
    errors: List[str]
    cleanup_path: Optional[str]
    done: bool = False


@dataclass
class Timing:
    t_tick0: float
    t_get_image0: float
    t_get_image1: float
    t_preflop0: float
    t_preflop1: float
    t_ocr0: float
    t_ocr1: float
    t_strategy0: float
    t_strategy1: float
    t_persist0: float
    t_persist1: float

    @staticmethod
    def empty() -> "Timing":
        z = time.perf_counter()
        return Timing(z, z, z, z, z, z, z, z, z, z, z)

    def as_ms(self) -> Dict[str, float]:
        return {
            "get_image": _ms(self.t_get_image1 - self.t_get_image0),
            "preflop": _ms(self.t_preflop1 - self.t_preflop0),
            "ocr": _ms(self.t_ocr1 - self.t_ocr0),
            "strategy": _ms(self.t_strategy1 - self.t_strategy0),
            "persist": _ms(self.t_persist1 - self.t_persist0),
            "tick_total": _ms(time.perf_counter() - self.t_tick0),
        }
