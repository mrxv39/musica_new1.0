from __future__ import annotations

import json
import os
import shutil
from typing import Any, Dict, Optional


def extract_time_mano_candidate(preflop: Any) -> Dict[str, Any]:
    if not isinstance(preflop, dict):
        return {"candidate_ok": False, "mano_ok": False, "time_ok": False, "mano": {}, "time": {}}

    mods = preflop.get("modules", {})
    if not isinstance(mods, dict):
        return {"candidate_ok": False, "mano_ok": False, "time_ok": False, "mano": {}, "time": {}}

    mano = mods.get("mano", {})
    time_mod = mods.get("time", {})

    mano_ok = False
    if isinstance(mano, dict):
        if "mano_ok" in mano:
            mano_ok = bool(mano.get("mano_ok"))
        elif "valid" in mano:
            mano_ok = bool(mano.get("valid"))
        else:
            hand_class = str(mano.get("hand_class", "")).strip()
            mano_raw = str(mano.get("mano_raw", "")).strip()
            mano_ok = bool(hand_class and hand_class != "??" and mano_raw and mano_raw != "UNKNOWNUNKNOWN")

    time_ok = False
    if isinstance(time_mod, dict):
        if "time_ok" in time_mod:
            time_ok = bool(time_mod.get("time_ok"))

    return {
        "candidate_ok": bool(mano_ok and time_ok),
        "mano_ok": bool(mano_ok),
        "time_ok": bool(time_ok),
        "mano": mano if isinstance(mano, dict) else {},
        "time": time_mod if isinstance(time_mod, dict) else {},
    }


def write_time_mano_candidate(
    *,
    dirs: Any,
    src_img_path: str,
    mesa: int,
    capture_id: Optional[int],
    image_fingerprint: Optional[str],
    preflop: Any,
) -> Optional[str]:
    info = extract_time_mano_candidate(preflop)
    if not info.get("candidate_ok"):
        return None

    base_dir = os.path.dirname(getattr(dirs, "err_dir"))
    cand_dir = os.path.join(base_dir, "time_mano_candidates")
    os.makedirs(cand_dir, exist_ok=True)

    base_name = os.path.basename(src_img_path)
    dst_img = os.path.join(cand_dir, base_name)
    shutil.copy2(src_img_path, dst_img)

    payload = {
        "mesa": mesa,
        "capture_id": capture_id,
        "image_fingerprint": image_fingerprint,
        "src_img_path": os.path.abspath(src_img_path),
        "candidate_img_path": os.path.abspath(dst_img),
        "preflop_ok": bool(preflop.get("preflop_ok")) if isinstance(preflop, dict) else False,
        "mano_ok": bool(info.get("mano_ok")),
        "time_ok": bool(info.get("time_ok")),
        "mano_raw": info.get("mano", {}).get("mano_raw"),
        "hand_class": info.get("mano", {}).get("hand_class"),
        "score1": info.get("mano", {}).get("score1"),
        "score2": info.get("mano", {}).get("score2"),
        "time_score": info.get("time", {}).get("score"),
        "noboard_ok": (
            bool(((preflop.get("modules") or {}).get("noboard") or {}).get("noboard_ok"))
            if isinstance(preflop, dict) else False
        ),
        "errors": preflop.get("errors", []) if isinstance(preflop, dict) else [],
        "preflop": preflop if isinstance(preflop, dict) else str(preflop),
    }

    with open(dst_img + ".json", "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2, default=str)

    return dst_img
