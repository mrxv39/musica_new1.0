# C:\Users\Usuario\Desktop\proyectos\poker_boss\modules\workers\worker_strategy.py
from typing import Any, Dict, Optional


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
    try:
        preflop_ok = bool(preflop.get("preflop_ok", False)) if isinstance(preflop, dict) else False
        mano_ok = bool(mano_result.get("valid", False)) if isinstance(mano_result, dict) else False

        pos = ocr.get("posiciones", {}) if isinstance(ocr, dict) else {}
        pos_ok = bool(pos.get("ok", False)) if isinstance(pos, dict) else False

        bets_ok = bool(bets_result.get("ok", False)) if isinstance(bets_result, dict) else False
        stacks_ok = bool(ocr_stacks.get("ok", False)) if isinstance(ocr_stacks, dict) else False
        se_ok = bool(stackefectivo_result.get("ok", False)) if isinstance(stackefectivo_result, dict) else False

        if preflop_ok and mano_ok and pos_ok and bets_ok and stacks_ok and se_ok and (select_move is not None) and (MatchInput is not None):
            hero_pos = str(pos.get("p1", "") or "")
            p2_pos = str(pos.get("p2", "") or "")
            p3_pos = str(pos.get("p3", "") or "")

            situacion = f"{hero_pos}_vs_{p2_pos}_{p3_pos}"

            p2_tipo = "unknown"
            p3_tipo = "unknown"
            if isinstance(villano_result, dict) and bool(villano_result.get("ok", False)):
                p2 = villano_result.get("p2", {}) if isinstance(villano_result.get("p2"), dict) else {}
                p3 = villano_result.get("p3", {}) if isinstance(villano_result.get("p3"), dict) else {}
                p2_tipo = str(p2.get("tipo", "unknown") or "unknown")
                p3_tipo = str(p3.get("tipo", "unknown") or "unknown")

            hand_class = str(mano_result.get("hand_class", "") or "") if isinstance(mano_result, dict) else ""

            inp = MatchInput(
                situacion=situacion,
                spot=hero_pos,
                hero_pos=hero_pos,
                hand_class=hand_class,
                p1_bet_bb=float(bets_result.get("p1", 0) or 0),
                p1_stack_bb=float(ocr_stacks.get("p1", 0) or 0),
                p1_se_bb=float(stackefectivo_result.get("value", 0) or 0),
                p2_pos=p2_pos,
                p2_tipo=p2_tipo,
                p2_bet_bb=float(bets_result.get("p2", 0) or 0),
                p2_stack_bb=float(ocr_stacks.get("p2", 0) or 0),
                p3_pos=p3_pos,
                p3_tipo=p3_tipo,
                p3_bet_bb=float(bets_result.get("p3", 0) or 0),
                p3_stack_bb=float(ocr_stacks.get("p3", 0) or 0),
            )

            decision = select_move(inp)
            strategy = {"ok": True, **decision, "situacion": situacion}
        else:
            strategy = {
                "ok": False,
                "reason": "missing_inputs_or_preflop_not_ok",
                "preflop_ok": preflop_ok,
                "mano_ok": mano_ok,
                "pos_ok": pos_ok,
                "bets_ok": bets_ok,
                "stacks_ok": stacks_ok,
                "stackefectivo_ok": se_ok,
            }

    except Exception as e:
        strategy = {"ok": False, "error": f"{type(e).__name__}: {e}"}

    return strategy
