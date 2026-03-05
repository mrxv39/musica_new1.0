# C:\Users\Usuario\Desktop\proyectos\poker_boss\modules\preflop\workers_loop\config.py
from __future__ import annotations

import os
import sys

# ---- FIX IMPORTS: ensure PROJECT_ROOT is on sys.path ----
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

# ✅ IMPORTANT: enable fallback SE like substrategy_selector --fallback_se
# This fixes "Expected exactly 1 match, got 0" when p1_se falls into gaps (e.g. 14-18)
DEFAULT_FALLBACK_SE_ENABLED = True

AREAS = [
    {"mesa": 1, "x1": 520,  "y1": 210, "x2": 1296, "y2": 807},
    {"mesa": 2, "x1": 520,  "y1": 807, "x2": 1296, "y2": 1404},
    {"mesa": 3, "x1": 1296, "y1": 210, "x2": 2072, "y2": 807},
    {"mesa": 4, "x1": 1296, "y1": 807, "x2": 2072, "y2": 1404},
]
