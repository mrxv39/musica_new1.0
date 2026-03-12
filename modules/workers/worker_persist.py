# C:\Users\Usuario\Desktop\proyectos\poker_boss\modules\workers\worker_persist.py
import time
import json
from typing import Any, Dict, Optional

from modules.workers.worker_utils import nested_get


def build_ocr_json(
    mano_result: Any,
    stacks_result: Any,
    ocr: Any,
    preflop: Any,
    strategy: Any,
    tempo_s: float,
) -> str:
    payload: Dict[str, Any] = {
        "mano": mano_result,
        "stacks_preflop": stacks_result,
        "ocr": ocr,
        "preflop": preflop,
        "strategy": strategy,
        "tempo_s": tempo_s,
    }
    return json.dumps(payload, ensure_ascii=False)


def _to_float(v: Any) -> Optional[float]:
    try:
        if v is None or v == "":
            return None
        return float(v)
    except Exception:
        return None


def persist_obs(
    dbmod: Any,
    *,
    sig: str,
    ts: float,
    mano_result: Any,
    preflop: Any,
    strategy: Any,
    ocr_json: str,
    bets_result: Optional[Dict[str, Any]] = None,
    frame_ref: str = "",
) -> None:
    # frame_ref:
    # - si viene explícito (replay) lo usamos
    # - si no, intentamos preflop.frame_ref (compat)
    if not frame_ref:
        frame_ref = preflop.get("frame_ref", "") if isinstance(preflop, dict) else ""

    preflop_ok = bool(preflop.get("preflop_ok", False)) if isinstance(preflop, dict) else False
    noboard_ok = bool(nested_get(preflop, ["modules", "noboard", "noboard_ok"], False))

    hand_class = ""
    if isinstance(mano_result, dict):
        hand_class = mano_result.get("hand_class", "") or ""

    p2bet = None
    p3bet = None
    if isinstance(bets_result, dict):
        p2bet = _to_float(bets_result.get("p2", None))
        p3bet = _to_float(bets_result.get("p3", None))

    p1_se_bb = None
    if isinstance(strategy, dict):
        p1_se_bb = _to_float(strategy.get("se_used", None))

    dbmod.insert_obs(
        fingerprint=sig,
        table_id="",
        detected_at_ms=int(ts * 1000),
        mano_raw=mano_result.get("mano_raw", "") or "",
        hand_class=hand_class,
        time_str=time.strftime("%H:%M:%S", time.localtime(ts)),
        preflop_ok=preflop_ok,
        noboard_ok=noboard_ok,
        ocr_json=ocr_json,
        p2bet=p2bet,
        p3bet=p3bet,
        p1_se_bb=p1_se_bb,
        frame_ref=frame_ref,
    )
