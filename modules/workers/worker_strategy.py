# C:\Users\Usuario\Desktop\proyectos\poker_boss\modules\workers\worker_strategy.py
from typing import Any, Dict, Optional

from modules.strategy.effective_stack import compute_effective_stack_bb
from modules.strategy.spot_strategy_engine import SpotDecisionInput, decide_spot_strategy


def _as_float(v: Any, default: float = 0.0) -> float:
    try:
        if v is None or v == "":
            return default
        return float(v)
    except Exception:
        return default


def _build_spot_key(
    hero_pos: str,
    p2_pos: str,
    p3_pos: str,
    bets: Dict[str, Any],
    table_state: Dict[str, Any],
    stacks: Optional[Dict[str, Any]] = None,
) -> str:
    """
    Build the spot_key that matches the Excel strategy scopes.

    Rules:
    - BTN: hero is BTN, first to act
    - SBvsBB: hero is SB, only BB left (HU or 3-handed no prior action)
    - SBvsBTN L/MR: hero is SB, BTN acted (limp=1bb, minraise=2bb)
    - BBvsSB L/MR: hero is BB, SB acted (limp=1bb, minraise=2bb)
    - BBvsSB OS: hero is BB, SB went all-in (stack=0, bet>0)
    - BBvsBTN L/MR: hero is BB, BTN acted (limp=1bb, minraise=2bb)
    - SQZ: hero faces a raise and a call (squeeze spot)
    """
    h = hero_pos.upper().strip()
    is_hu = bool(table_state.get("is_hu", False)) if isinstance(table_state, dict) else False
    stacks = stacks or {}

    p2_bet = _as_float(bets.get("p2", 0), 0)
    p3_bet = _as_float(bets.get("p3", 0), 0)
    p2_stack = _as_float(stacks.get("p2", None), None)
    p3_stack = _as_float(stacks.get("p3", None), None)

    if h == "BTN":
        return "BTN"

    if h == "SB":
        if is_hu:
            return "SBvsBB HU"
        # 3H: check if BTN acted before us
        btn_bet = 0.0
        if p2_pos.upper().strip() == "BTN":
            btn_bet = p2_bet
        elif p3_pos.upper().strip() == "BTN":
            btn_bet = p3_bet
        if btn_bet >= 2:
            return "SBvsBTN MR"
        if btn_bet >= 1:
            return "SBvsBTN L"
        return "SBvsBB"

    if h == "BB":
        # Collect info for each villain by position
        villains = {}
        for seat_pos, seat_bet, seat_stack in [
            (p2_pos.upper().strip(), p2_bet, p2_stack),
            (p3_pos.upper().strip(), p3_bet, p3_stack),
        ]:
            if seat_pos in ("SB", "BTN"):
                villains[seat_pos] = {"bet": seat_bet, "stack": seat_stack}

        sb = villains.get("SB", {})
        btn = villains.get("BTN", {})

        # SB all-in: stack=0 and bet>0 (works in HU and 3H where BTN folded)
        sb_stack = sb.get("stack")
        sb_bet = sb.get("bet", 0)
        if sb_stack is not None and sb_stack == 0 and sb_bet > 0:
            return "BBvsSB OS"

        # Determine who acted (the villain with the highest bet, excluding folded BTN)
        btn_bet = btn.get("bet", 0)
        if sb_bet > 0 and sb_bet >= btn_bet:
            return "BBvsSB MR" if sb_bet >= 2 else "BBvsSB_LIMP"
        if btn_bet > 0:
            return "BBvsBTN MR" if btn_bet >= 2 else "BBvsBTN L"
        # Fallback: SB limped
        if "SB" in villains:
            return "BBvsSB_LIMP"
        return "BBvsBTN L"

    return h


def _normalize_hu_positions(
    p2_pos: str, p3_pos: str,
    bets_fixed: Dict[str, Any],
    p2_tipo: str, p3_tipo: str,
    ocr_stacks: Dict[str, Any],
    table_state: Dict[str, Any],
) -> Dict[str, Any]:
    """
    In HU, the active villain can be in p2 or p3 depending on who got eliminated.
    The Excel strategies always expect the villain in p2 position.
    This function swaps p2↔p3 if needed so the villain lands in p2.
    """
    is_hu = bool(table_state.get("is_hu", False)) if isinstance(table_state, dict) else False
    if not is_hu:
        return {
            "p2_pos": p2_pos, "p3_pos": p3_pos,
            "p2_tipo": p2_tipo, "p3_tipo": p3_tipo,
            "p1_bet": bets_fixed["p1_used"], "p2_bet": bets_fixed["p2_used"], "p3_bet": bets_fixed["p3_used"],
            "p2_stack": _as_float(ocr_stacks.get("p2", 0), 0),
            "p3_stack": _as_float(ocr_stacks.get("p3", 0), 0),
        }

    # HU: find which seat has the active villain
    p2_active = bool(p2_pos.strip())
    p3_active = bool(p3_pos.strip())

    if p3_active and not p2_active:
        # Villain is in p3 — swap to p2. In HU, p3_tipo inherits p2_tipo for scope matching.
        return {
            "p2_pos": p3_pos, "p3_pos": "",
            "p2_tipo": p3_tipo, "p3_tipo": p3_tipo,
            "p1_bet": bets_fixed["p1_used"], "p2_bet": bets_fixed["p3_used"], "p3_bet": 0.0,
            "p2_stack": _as_float(ocr_stacks.get("p3", 0), 0),
            "p3_stack": 0.0,
        }

    # p2 is already the villain or both empty — no swap needed
    return {
        "p2_pos": p2_pos, "p3_pos": p3_pos,
        "p2_tipo": p2_tipo, "p3_tipo": p3_tipo,
        "p1_bet": bets_fixed["p1_used"], "p2_bet": bets_fixed["p2_used"], "p3_bet": bets_fixed["p3_used"],
        "p2_stack": _as_float(ocr_stacks.get("p2", 0), 0),
        "p3_stack": _as_float(ocr_stacks.get("p3", 0), 0),
    }


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
        def in_range(x: Any) -> bool:
            try:
                if x is None:
                    return False
                v = float(x)
                return 0.01 <= v <= 75.0
            except Exception:
                return False

        se_external_valid = False
        p1_bet = _as_float(bets_result.get("p1", 0.0), 0.0) if isinstance(bets_result, dict) else 0.0
        p2_bet = _as_float(bets_result.get("p2", 0.0), 0.0) if isinstance(bets_result, dict) else 0.0
        p3_bet = _as_float(bets_result.get("p3", 0.0), 0.0) if isinstance(bets_result, dict) else 0.0
        # Stacks and bets from OCR are already in BB units — no division needed.
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
        else:
            se_used = None
            se_method = "none"

        if preflop_ok and mano_ok and pos_ok and bets_ok and stacks_ok and (se_used is not None):
            hero_pos = str(pos.get("p1", "") or "")
            p2_pos = str(pos.get("p2", "") or "")
            p3_pos = str(pos.get("p3", "") or "")

            bets_fixed = _fix_bets_for_matching(hero_pos=hero_pos, bets_result=bets_result)

            table_state = ocr.get("table_state", {}) if isinstance(ocr, dict) else {}
            spot_key = _build_spot_key(hero_pos, p2_pos, p3_pos, bets_result, table_state, ocr_stacks)

            p2_tipo_raw = "unknown"
            p3_tipo_raw = "unknown"
            if isinstance(villano_result, dict) and bool(villano_result.get("ok", False)):
                p2v = villano_result.get("p2", {}) if isinstance(villano_result.get("p2"), dict) else {}
                p3v = villano_result.get("p3", {}) if isinstance(villano_result.get("p3"), dict) else {}
                p2_tipo_raw = str(p2v.get("tipo", "unknown") or "unknown").strip().upper() or "UNKNOWN"
                p3_tipo_raw = str(p3v.get("tipo", "unknown") or "unknown").strip().upper() or "UNKNOWN"

            # Normalize HU: swap p3→p2 if villain is in p3 and p2 is eliminated
            norm = _normalize_hu_positions(
                p2_pos, p3_pos, bets_fixed, p2_tipo_raw, p3_tipo_raw, ocr_stacks, table_state,
            )
            p2_pos_n = norm["p2_pos"]
            p3_pos_n = norm["p3_pos"]
            p2_tipo = norm["p2_tipo"]
            p3_tipo = norm["p3_tipo"]

            situacion = f"{hero_pos}_vs_{p2_pos_n}_{p3_pos_n}_{p2_tipo}_{p3_tipo}"

            hand_class = str(mano_result.get("hand_class", "") or "") if isinstance(mano_result, dict) else ""
            # Compat: legacy tests can inject MatchInput/select_move to bypass DB engine.
            if (MatchInput is not None) and (select_move is not None):
                inp = MatchInput(
                    situacion=situacion,
                    spot=spot_key,
                    hero_pos=hero_pos,
                    hand_class=hand_class,
                    p1_bet_bb=float(norm["p1_bet"]),
                    p1_stack_bb=float(ocr_stacks.get("p1", 0) or 0),
                    p1_se_bb=float(se_used),
                    p2_pos=p2_pos_n,
                    p2_tipo=p2_tipo,
                    p2_bet_bb=float(norm["p2_bet"]),
                    p2_stack_bb=float(norm["p2_stack"]),
                    p3_pos=p3_pos_n,
                    p3_tipo=p3_tipo,
                    p3_bet_bb=float(norm["p3_bet"]),
                    p3_stack_bb=float(norm["p3_stack"]),
                )
                decision = select_move(inp)
            else:
                from modules.db.db import get_conn

                conn = get_conn()
                try:
                    decision = decide_spot_strategy(
                        conn,
                        SpotDecisionInput(
                            spot_key=spot_key,
                            hand_class=hand_class,
                            p1_se_bb=float(se_used),
                            p1_bet_bb=float(norm["p1_bet"]),
                            p2_pos=p2_pos_n,
                            p3_pos=p3_pos_n,
                            p2_tipo=p2_tipo,
                            p3_tipo=p3_tipo,
                        ),
                    )
                finally:
                    conn.close()
            strategy = {
                "ok": True,
                **decision,
                "situacion": situacion,
                "bets_p1_raw": bets_fixed["p1_raw"],
                "bets_p2_raw": bets_fixed["p2_raw"],
                "bets_p3_raw": bets_fixed["p3_raw"],
                "bets_p1_used": bets_fixed["p1_used"],
                "bets_p2_used": bets_fixed["p2_used"],
                "bets_p3_used": bets_fixed["p3_used"],
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
                "bets_p1_used": _as_float(bets_result.get("p1", 0.0), 0.0) if isinstance(bets_result, dict) else 0.0,
                "bets_p2_used": _as_float(bets_result.get("p2", 0.0), 0.0) if isinstance(bets_result, dict) else 0.0,
                "bets_p3_used": _as_float(bets_result.get("p3", 0.0), 0.0) if isinstance(bets_result, dict) else 0.0,
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
