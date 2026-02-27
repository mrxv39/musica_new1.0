# C:\Users\Usuario\Desktop\proyectos\poker_boss\modules\workers\worker_dedupe.py
import hashlib
from typing import Any, Optional, Tuple


def normalize_p1(stacks_result: Any, ocr_stacks: Any) -> float:
    p1_raw = stacks_result.get("p1", None) if isinstance(stacks_result, dict) else None
    if p1_raw is None and isinstance(ocr_stacks, dict):
        p1_raw = ocr_stacks.get("p1", None)

    if isinstance(p1_raw, (int, float)) and p1_raw is not None:
        return float(p1_raw)
    return 0.0


def compute_can_persist(
    mano_result: Any,
    p1: float,
    persist_without_stack: bool,
    preflop_ok: bool,
) -> bool:
    mano_valid = bool(mano_result.get("valid")) if isinstance(mano_result, dict) else False
    # Regla: si preflop_ok == False => NO persistir
    return bool(preflop_ok) and mano_valid and (p1 > 0 or persist_without_stack)


def compute_sig(mano_result: Any, p1: float, persist_without_stack: bool) -> str:
    mano_raw = ""
    if isinstance(mano_result, dict):
        mano_raw = str(mano_result.get("mano_raw") or "")
    base = f"{mano_raw}" if persist_without_stack else f"{mano_raw}|{p1}"
    return hashlib.sha1(base.encode("utf-8", errors="ignore")).hexdigest()


def apply_dedupe(
    can_persist: bool,
    sig: Optional[str],
    last_hand_sig: Optional[str],
) -> Tuple[bool, Optional[str], Optional[str]]:
    """
    Returns: dedupe_skipped, dedupe_reason, new_last_hand_sig
    """
    if not can_persist or not sig:
        return False, "no_dedupe", last_hand_sig

    if sig == last_hand_sig:
        return True, "duplicate_hand", last_hand_sig

    return False, None, sig
