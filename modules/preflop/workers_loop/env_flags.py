from __future__ import annotations

import os
from typing import Optional


def enable_fallback_env(enabled: bool) -> None:
    if enabled:
        os.environ["POKER_BOSS_FALLBACK_SE"] = "1"
    else:
        os.environ.pop("POKER_BOSS_FALLBACK_SE", None)


def debug_enabled() -> bool:
    v = (os.environ.get("POKER_BOSS_WORKERS_LOOP_DEBUG", "") or "").strip().lower()
    return v in ("1", "true", "yes", "y", "on")


def pytest_fixed_input(base_dir: str) -> Optional[str]:
    """
    Integration tests run this loop as a subprocess. Python monkeypatches in the parent
    do NOT apply in the subprocess. To make the entrypoint deterministic under pytest,
    if we detect pytest and a fixed_input.bmp exists in out_dir, use it as capture source.
    """
    if not os.environ.get("PYTEST_CURRENT_TEST"):
        return None
    p = os.path.join(base_dir, "fixed_input.bmp")
    if os.path.isfile(p):
        return p
    return None
