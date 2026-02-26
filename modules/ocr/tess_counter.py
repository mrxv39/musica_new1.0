# C:\Users\Usuario\Desktop\proyectos\poker_boss\modules\ocr\tess_counter.py
from __future__ import annotations
from dataclasses import dataclass, field
from typing import Dict

@dataclass
class TessCounter:
    calls: int = 0
    by_tag: Dict[str, int] = field(default_factory=dict)

    def inc(self, tag: str) -> None:
        self.calls += 1
        self.by_tag[tag] = self.by_tag.get(tag, 0) + 1

_COUNTER = TessCounter()

def reset() -> None:
    global _COUNTER
    _COUNTER = TessCounter()

def inc(tag: str) -> None:
    _COUNTER.inc(tag)

def snapshot() -> Dict:
    return {"calls": _COUNTER.calls, "by_tag": dict(_COUNTER.by_tag)}
