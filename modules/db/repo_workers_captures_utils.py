from __future__ import annotations

import json
from typing import Any, Dict


def to_json(v: Any) -> str:
    try:
        return json.dumps(v if v is not None else {}, ensure_ascii=False)
    except Exception:
        return "{}"


def to_json_list(v: Any) -> str:
    try:
        return json.dumps(v if v is not None else [], ensure_ascii=False)
    except Exception:
        return "[]"


def b(v: Any) -> int:
    return 1 if bool(v) else 0


def parse_ocr_json(ocr_json: str) -> Dict[str, Any]:
    if not ocr_json:
        return {}
    try:
        data = json.loads(ocr_json)
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}
