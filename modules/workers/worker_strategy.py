# C:\Users\Usuario\Desktop\proyectos\poker_boss\modules\workers\worker_strategy.py
from typing import Any, Dict, Optional

from modules.strategy.effective_stack import compute_effective_stack_bb


def _as_float(v: Any, default: float = 0.0) -> float:
    try:
        if v is None or v == "":
            return default
        return float(v)
    except Exception:
        return default


def _fix_bets_for_matching(hero_pos: str, bets_result: Any) -> Dict[str, Any]:
    """
    OCR de bets a veces confunde el bet del hero en BTN (aún sin actuar) con el pot/otra cifra y devuelve ~3.
    Para matching de estrategia, si BTN aún no actuó su bet debería ser 0.

    Heurística conservadora:
    - Si hero_pos == "BTN"
    - y p1_bet >= 2.0
    - y p2_bet <= 1.0 y p3_bet <= 1.0  (solo ciegas / sin acción postflop)
    entonces forzamos p1_bet_used = 0.0.
    """
    b = bets_result if isinstance(bets_result, dict) else {}
    p1 = _as_float(b.get("p1", 0.0), 0.0)
    p2 = _as_float(b.get("p2", 0.0), 0.0)
    p3 = _as_float(b.get("p3", 0.0), 0.0)

    hero = (hero_pos or "").upper().strip()
    reason = ""
    p1_used = p1
    if hero == "BTN" and p1 >= 2.0 and p2 <= 1.0 and p3 <= 1.0:
        p1_used = 0.0
        reason = "btn_unacted_p1_bet_looks_like_pot"

    return {
        "p1_raw": p1,
        "p2_raw": p2,
        "p3_raw": p3,
        "p1_used": p1_used,
        "p2_used": p2,
        "p3_used": p3,
        "reason": reason,
    }


def compute_strategy(
    preflop: Any,
    mano_result: Any,
    ocr: Any,
    bets_result: Any,
    ocr_stacks: Any,
    stackefectivo_result: Any,
    villano_result: Any,
    MatchInput: Optional[Any],
    select_move: Optional[Any],
) -> Dict:
    strategy: Dict = {"ok": False}
    # Keep SE diagnostics even if select_move throws.
    se_external = None
    se_derived = None
    se_used = None
    se_external_valid = False
    se_derived_valid = False
    se_method = "none"
    try:
        preflop_ok = bool(preflop.get("preflop_ok", False)) if isinstance(preflop, dict) else False
        mano_ok = bool(mano_result.get("valid", False)) if isinstance(mano_result, dict) else False

        pos = ocr.get("posiciones", {}) if isinstance(ocr, dict) else {}
        pos_ok = bool(pos.get("ok", False)) if isinstance(pos, dict) else False

        bets_ok = bool(bets_result.get("ok", False)) if isinstance(bets_result, dict) else False
        stacks_ok = bool(ocr_stacks.get("ok", False)) if isinstance(ocr_stacks, dict) else False
        try:
            se_external = float(stackefectivo_result.get("value")) if isinstance(stackefectivo_result, dict) else None
        except Exception:
            se_external = None

        def in_range(x: Any) -> bool:
            try:
                if x is None:
                    return False
                v = float(x)
                return 0.01 <= v <= 75.0
            except Exception:
                return False

        se_external_valid = in_range(se_external)
        se_derived = compute_effective_stack_bb(
            posiciones=pos if isinstance(pos, dict) else {},
            stacks=ocr_stacks if isinstance(ocr_stacks, dict) else {},
            bets=bets_result if isinstance(bets_result, dict) else {},
        )
        se_derived_valid = in_range(se_derived)

        # Choose SE used for matching
        if se_derived_valid:
            se_used = float(se_derived)
            se_method = "derived"
        elif se_external_valid:
            se_used = float(se_external)
            se_method = "external"
        else:
            se_used = None
            se_method = "none"

        if preflop_ok and mano_ok and pos_ok and bets_ok and stacks_ok and (se_used is not None) and (select_move is not None) and (MatchInput is not None):
            hero_pos = str(pos.get("p1", "") or "")
            p2_pos = str(pos.get("p2", "") or "")
            p3_pos = str(pos.get("p3", "") or "")

            bets_fixed = _fix_bets_for_matching(hero_pos=hero_pos, bets_result=bets_result)

            p2_tipo = "unknown"
            p3_tipo = "unknown"
            if isinstance(villano_result, dict) and bool(villano_result.get("ok", False)):
                p2 = villano_result.get("p2", {}) if isinstance(villano_result.get("p2"), dict) else {}
                p3 = villano_result.get("p3", {}) if isinstance(villano_result.get("p3"), dict) else {}
                # Normalize to match DB conventions (strategies use e.g. FISH/REG).
                p2_tipo = str(p2.get("tipo", "unknown") or "unknown").strip().upper() or "UNKNOWN"
                p3_tipo = str(p3.get("tipo", "unknown") or "unknown").strip().upper() or "UNKNOWN"

            # Strategy situation key is stored in spots.name, convention:
            #   "{HERO}_vs_{P2POS}_{P3POS}_{P2TIPO}_{P3TIPO}"
            situacion = f"{hero_pos}_vs_{p2_pos}_{p3_pos}_{p2_tipo}_{p3_tipo}"

            hand_class = str(mano_result.get("hand_class", "") or "") if isinstance(mano_result, dict) else ""

            inp = MatchInput(
                situacion=situacion,
                spot=hero_pos,
                hero_pos=hero_pos,
                hand_class=hand_class,
                p1_bet_bb=float(bets_fixed["p1_used"]),
                p1_stack_bb=float(ocr_stacks.get("p1", 0) or 0),
                p1_se_bb=float(se_used),
                p2_pos=p2_pos,
                p2_tipo=p2_tipo,
                p2_bet_bb=float(bets_fixed["p2_used"]),
                p2_stack_bb=float(ocr_stacks.get("p2", 0) or 0),
                p3_pos=p3_pos,
                p3_tipo=p3_tipo,
                p3_bet_bb=float(bets_fixed["p3_used"]),
                p3_stack_bb=float(ocr_stacks.get("p3", 0) or 0),
            )

            decision = select_move(inp)
            strategy = {
                "ok": True,
                **decision,
                "situacion": situacion,
                "bets_p1_raw": bets_fixed["p1_raw"],
                "bets_p2_raw": bets_fixed["p2_raw"],
                "bets_p3_raw": bets_fixed["p3_raw"],
                "bets_p1_used": bets_fixed["p1_used"],
                "bets_fix_reason": bets_fixed["reason"] or None,
                "se_external": se_external,
                "se_derived": se_derived,
                "se_used": float(se_used) if se_used is not None else None,
                "se_method": se_method,
            }
        else:
            strategy = {
                "ok": False,
                "reason": "missing_inputs_or_preflop_not_ok",
                "preflop_ok": preflop_ok,
                "mano_ok": mano_ok,
                "pos_ok": pos_ok,
                "bets_ok": bets_ok,
                "stacks_ok": stacks_ok,
                "bets_p1_raw": _as_float(bets_result.get("p1", 0.0), 0.0) if isinstance(bets_result, dict) else 0.0,
                "bets_p2_raw": _as_float(bets_result.get("p2", 0.0), 0.0) if isinstance(bets_result, dict) else 0.0,
                "bets_p3_raw": _as_float(bets_result.get("p3", 0.0), 0.0) if isinstance(bets_result, dict) else 0.0,
                "se_external": se_external,
                "se_derived": se_derived,
                "se_used": float(se_used) if se_used is not None else None,
                "se_method": se_method,
            }

    except Exception as e:
        strategy = {
            "ok": False,
            "error": f"{type(e).__name__}: {e}",
            "se_external": se_external,
            "se_derived": se_derived,
            "se_used": float(se_used) if se_used is not None else None,
            "se_method": se_method,
        }

    return strategy
