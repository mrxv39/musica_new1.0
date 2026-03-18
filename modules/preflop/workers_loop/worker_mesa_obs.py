from __future__ import annotations

import json
import logging
import os
import time
from typing import Any, Optional


def update_obs_frame_ref(dbmod: Any, fingerprint: str, new_frame_ref: str) -> bool:
    try:
        conn = dbmod.get_conn()
        cur = conn.cursor()
        cur.execute(
            "UPDATE hands_obs SET frame_ref = ? WHERE fingerprint = ?",
            (new_frame_ref, fingerprint),
        )
        conn.commit()
        return True
    except Exception:
        logging.exception(f"update_obs_frame_ref failed for fingerprint={fingerprint}")
        return False


def _to_float(v: Any) -> Optional[float]:
    try:
        if v is None or v == "":
            return None
        return float(v)
    except Exception:
        logging.debug(f"Failed to convert value to float: {v}", exc_info=True)
        return None


def persist_preflop_obs(
    *,
    dbmod: Any,
    preflop: Any,
    image_fp: Optional[str],
    img_path: str,
    mesa: int,
    ocr: Any = None,
    mano_result: Any = None,
    stacks_result: Any = None,
    strategy: Any = None,
    tempo_s: float = 0.0,
) -> Optional[int]:
    if not image_fp or not isinstance(preflop, dict):
        return None

    mods = preflop.get("modules", {})
    if not isinstance(mods, dict):
        mods = {}

    mano = mods.get("mano", {})
    if not isinstance(mano, dict):
        mano = {}

    time_mod = mods.get("time", {})
    if not isinstance(time_mod, dict):
        time_mod = {}

    noboard = mods.get("noboard", {})
    if not isinstance(noboard, dict):
        noboard = {}

    if not isinstance(mano_result, dict):
        mano_result = mano

    mano_raw = str((mano_result or {}).get("mano_raw", "") or mano.get("mano_raw", "") or "")
    hand_class = str((mano_result or {}).get("hand_class", "") or mano.get("hand_class", "") or "")
    time_str = str(
        time_mod.get("time_str", "")
        or time_mod.get("value", "")
        or time_mod.get("text", "")
        or ""
    )

    bets_result = {}
    if isinstance(ocr, dict):
        maybe_bets = ocr.get("bets", {})
        if isinstance(maybe_bets, dict):
            bets_result = maybe_bets

    p2bet = _to_float(bets_result.get("p2", None))
    p3bet = _to_float(bets_result.get("p3", None))

    if p2bet is None:
        p2bet = _to_float(mano.get("p2bet", None))
    if p3bet is None:
        p3bet = _to_float(mano.get("p3bet", None))

    p1_se_bb = None
    if isinstance(strategy, dict):
        p1_se_bb = _to_float(strategy.get("se_used", None))

    gamecode_result = ocr.get("gamecode", {}) if isinstance(ocr, dict) else {}
    captured_gamecode = None
    if isinstance(gamecode_result, dict) and gamecode_result.get("ok") is True:
        raw_gamecode = gamecode_result.get("value", None)
        if raw_gamecode is not None and str(raw_gamecode).strip() != "":
            captured_gamecode = str(raw_gamecode).strip()

    payload = {
        "mano": mano_result if isinstance(mano_result, dict) else {},
        "stacks_preflop": stacks_result if isinstance(stacks_result, dict) else {},
        "ocr": ocr if isinstance(ocr, dict) else {},
        "preflop": preflop if isinstance(preflop, dict) else {},
        "strategy": strategy if isinstance(strategy, dict) else {},
        "tempo_s": tempo_s,
    }

    ocr_json = json.dumps(payload, ensure_ascii=False, default=str)

    return dbmod.insert_obs(
        fingerprint=image_fp,
        table_id=f"mesa_{mesa}",
        detected_at_ms=int(time.time() * 1000),
        mano_raw=mano_raw,
        hand_class=hand_class,
        time_str=time_str,
        preflop_ok=bool(preflop.get("preflop_ok")),
        noboard_ok=bool(noboard.get("noboard_ok")),
        ocr_json=ocr_json,
        p2bet=p2bet,
        p3bet=p3bet,
        p1_se_bb=p1_se_bb,
        captured_gamecode=captured_gamecode,
        frame_ref=os.path.abspath(img_path),
    )
