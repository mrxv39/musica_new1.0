from __future__ import annotations

import json
import logging
import os
from typing import Any, Dict


def short_value(v: Any, max_len: int = 240) -> str:
    try:
        s = json.dumps(v, ensure_ascii=False, default=str)
    except Exception:
        logging.debug(f"json.dumps failed for value type={type(v).__name__}", exc_info=True)
        try:
            s = str(v)
        except Exception:
            logging.debug(f"str() failed for value type={type(v).__name__}", exc_info=True)
            s = "<unprintable>"
    s = s.replace("\r", " ").replace("\n", " ")
    if len(s) > max_len:
        s = s[: max_len - 3] + "..."
    return s


def describe_preflop_fail(preflop: Any) -> str:
    if preflop is None:
        return "preflop is None"

    if not isinstance(preflop, dict):
        return f"preflop is not dict: type={type(preflop).__name__} value={short_value(preflop)}"

    reasons = []

    preflop_ok = preflop.get("preflop_ok", None)
    if preflop_ok is not True:
        reasons.append(f"preflop_ok={preflop_ok!r}")

    for key in (
        "error",
        "reason",
        "message",
        "status",
        "debug",
        "hero",
        "hero_cards",
        "hand",
        "position",
        "positions",
        "situacion",
        "stackefectivo",
        "villano",
        "action",
    ):
        if key in preflop and preflop.get(key) not in (None, "", [], {}):
            reasons.append(f"{key}={short_value(preflop.get(key))}")

    if not reasons:
        reasons.append(f"payload={short_value(preflop)}")

    return " | ".join(reasons)


def write_preflop_fail_debug(dst_img_path: str, mesa: int, preflop: Any) -> None:
    dbg_path = dst_img_path + ".preflop_fail.json"
    payload = {
        "mesa": mesa,
        "reason_text": describe_preflop_fail(preflop),
        "preflop": preflop if isinstance(preflop, dict) else short_value(preflop, max_len=2000),
    }
    with open(dbg_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2, default=str)


_cached_rank_templates = None
_cached_suit_templates = None


def _get_templates():
    global _cached_rank_templates, _cached_suit_templates
    if _cached_rank_templates is None:
        from modules.preflop.mano import load_templates
        _cached_rank_templates = load_templates()
        try:
            from modules.preflop.mano import load_suit_templates
            _cached_suit_templates = load_suit_templates()
        except ImportError:
            _cached_suit_templates = None
    return _cached_rank_templates, _cached_suit_templates


def run_preflop_direct(img_path: str, timeout_sec: int = 30) -> Dict[str, Any]:
    """Run preflop pipeline via direct imports with cached templates."""
    from modules.preflop.preflop import run_preflop

    try:
        rt, st = _get_templates()
        data = run_preflop(img_path)
        data.setdefault("preflop_ok", False)
        data.setdefault("image_path", img_path)
        return data
    except Exception as e:
        return {
            "preflop_ok": False,
            "error": f"run_preflop_exception: {type(e).__name__}: {e}",
            "image_path": img_path,
        }
