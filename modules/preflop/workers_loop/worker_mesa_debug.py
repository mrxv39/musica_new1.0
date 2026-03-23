from __future__ import annotations

import json
import os
from typing import Any, Dict, Optional


def safe_remove(path: str) -> None:
    try:
        if path and os.path.exists(path):
            os.remove(path)
    except Exception:
        pass


def write_no_strategy_debug(
    *,
    dst: str,
    mesa: int,
    preflop: Any,
    strategy: Any,
    ocr: Any,
    out: Any,
    image_fingerprint: Optional[str],
    capture_id: Optional[int],
) -> None:
    dbg_payload: Dict[str, Any] = {
        "mesa": mesa,
        "fallback_se": os.environ.get("POKER_BOSS_FALLBACK_SE", ""),
        "preflop_ok": bool(preflop.get("preflop_ok")) if isinstance(preflop, dict) else None,
        "strategy": strategy if isinstance(strategy, dict) else str(strategy),
        "ocr": ocr if isinstance(ocr, dict) else str(ocr),
        "out": out,
        "image_fingerprint": image_fingerprint,
        "capture_id": capture_id,
    }
    dbg_path = dst + ".debug.json"
    with open(dbg_path, "w", encoding="utf-8") as f:
        json.dump(dbg_payload, f, ensure_ascii=False, indent=2)
