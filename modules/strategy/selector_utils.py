# C:\Users\Usuario\Desktop\proyectos\poker_boss\modules\strategy\selector_utils.py
from __future__ import annotations

import json
import os
import sqlite3
from typing import Any, Dict


def as_text(v: Any) -> str:
    if v is None:
        return ""
    return str(v)


def req_str(payload: Dict[str, Any], key: str) -> str:
    """Required string field: must exist and be non-empty after strip."""
    v = payload.get(key, None)
    s = as_text(v).strip()
    if not s:
        raise ValueError(f"payload missing/empty required field '{key}'")
    return s


def req_float(payload: Dict[str, Any], key: str) -> float:
    """Required numeric field: must exist and parse to float."""
    v = payload.get(key, None)
    if v is None or (isinstance(v, str) and not v.strip()):
        raise ValueError(f"payload missing required numeric field '{key}'")
    try:
        return float(v)
    except Exception:
        raise ValueError(f"payload invalid numeric field '{key}': {v!r}")


def load_payload(row: sqlite3.Row) -> Dict[str, Any]:
    try:
        return json.loads(row["payload_json"] or "{}")
    except Exception:
        return {}


def norm_str(s: str) -> str:
    return (s or "").strip()


def norm_upper(s: str) -> str:
    return norm_str(s).upper()


def norm_lower(s: str) -> str:
    return norm_str(s).lower()


def env_truthy(name: str, default: str = "0") -> bool:
    v = os.getenv(name, default)
    return str(v).strip().lower() in ("1", "true", "yes", "y", "on")