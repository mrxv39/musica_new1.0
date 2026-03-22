# C:\Users\Usuario\Desktop\proyectos\poker_boss\modules\workers\worker_preflop.py
from typing import Dict

from modules.preflop.preflop import run_preflop as _run_preflop_direct


def run_preflop(image_path: str) -> Dict:
    """Run preflop pipeline via direct import (no subprocess)."""
    return _run_preflop_direct(image_path)
