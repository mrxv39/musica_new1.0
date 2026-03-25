from __future__ import annotations

from typing import Any, Dict

from .repo_workers_captures_utils import b, to_json, to_json_list


def flatten_ocr(ocr: Dict[str, Any]) -> Dict[str, Any]:
    ocr = ocr or {}

    names = ocr.get("names") or {}
    villano = ocr.get("villano") or {}
    stackefectivo = ocr.get("stackefectivo") or {}
    bets = ocr.get("bets") or {}
    stacks = ocr.get("stacks") or {}
    table_state = ocr.get("table_state") or {}
    dealer = ocr.get("dealer") or {}
    posiciones = ocr.get("posiciones") or {}

    return {
        "ocr_errors_json": to_json_list(ocr.get("errors") or []),

        # names
        "names_ok": b(names.get("ok")),
        "p2_name": names.get("p2_name") or "",
        "p3_name": names.get("p3_name") or "",
        "names_errors_json": to_json_list(names.get("errors") or []),
        "names_json": to_json(names),

        # villano
        "villano_ok": b(villano.get("ok")),
        "villano_p2_name": ((villano.get("p2") or {}).get("name") or ""),
        "villano_p2_tipo": ((villano.get("p2") or {}).get("tipo") or ""),
        "villano_p3_name": ((villano.get("p3") or {}).get("name") or ""),
        "villano_p3_tipo": ((villano.get("p3") or {}).get("tipo") or ""),
        "villano_created_json": to_json_list(villano.get("created") or []),
        "villano_errors_json": to_json_list(villano.get("errors") or []),
        "villano_json": to_json(villano),

        # stackefectivo
        "stackefectivo_ok": b(stackefectivo.get("ok")),
        "stackefectivo_value": stackefectivo.get("value"),
        "stackefectivo_raw": stackefectivo.get("raw_text") or "",
        "stackefectivo_method": stackefectivo.get("method") or "",
        "stackefectivo_roi_json": to_json(stackefectivo.get("roi") or []),
        "stackefectivo_error": stackefectivo.get("error") or "",
        "stackefectivo_json": to_json(stackefectivo),

        # bets
        "bets_ok": b(bets.get("ok")),
        "bet_p1": bets.get("p1"),
        "bet_p2": bets.get("p2"),
        "bet_p3": bets.get("p3"),
        "bet_raw_p1": ((bets.get("raw") or {}).get("p1") or ""),
        "bet_raw_p2": ((bets.get("raw") or {}).get("p2") or ""),
        "bet_raw_p3": ((bets.get("raw") or {}).get("p3") or ""),
        "bet_method_p1": ((bets.get("method") or {}).get("p1") or ""),
        "bet_method_p2": ((bets.get("method") or {}).get("p2") or ""),
        "bet_method_p3": ((bets.get("method") or {}).get("p3") or ""),
        "bets_errors_json": to_json_list(bets.get("errors") or []),
        "bets_json": to_json(bets),

        # stacks
        "stacks_ok": b(stacks.get("ok")),
        "stack_p1": stacks.get("p1"),
        "stack_p2": stacks.get("p2"),
        "stack_p3": stacks.get("p3"),
        "stack_raw_p1": ((stacks.get("raw") or {}).get("p1") or ""),
        "stack_raw_p2": ((stacks.get("raw") or {}).get("p2") or ""),
        "stack_raw_p3": ((stacks.get("raw") or {}).get("p3") or ""),
        "stack_method_p1": ((stacks.get("method") or {}).get("p1") or ""),
        "stack_method_p2": ((stacks.get("method") or {}).get("p2") or ""),
        "stack_method_p3": ((stacks.get("method") or {}).get("p3") or ""),
        "stacks_errors_json": to_json_list(stacks.get("errors") or []),
        "stacks_json": to_json(stacks),

        # table_state
        "table_state_ok": b(table_state.get("ok")),
        "table_players": table_state.get("players"),
        "table_is_hu": b(table_state.get("is_hu")),
        "table_is_3h": b(table_state.get("is_3h")),
        "table_active_seats_json": to_json(table_state.get("active_seats") or []),
        "table_eliminated_seats_json": to_json(table_state.get("eliminated_seats") or []),
        "table_state_method": table_state.get("method") or "",
        "table_state_errors_json": to_json_list(table_state.get("errors") or []),
        "table_state_json": to_json(table_state),

        # dealer
        "dealer_ok": b(dealer.get("ok")),
        "dealer_seat": dealer.get("dealer_seat") or "",
        "dealer_score": dealer.get("score"),
        "dealer_method": dealer.get("method") or "",
        "dealer_errors_json": to_json_list(dealer.get("errors") or []),
        "dealer_debug_json": to_json(dealer.get("debug") or {}),
        "dealer_json": to_json(dealer),

        # posiciones
        "posiciones_ok": b(posiciones.get("ok")),
        "pos_p1": posiciones.get("p1") or "",
        "pos_p2": posiciones.get("p2") or "",
        "pos_p3": posiciones.get("p3") or "",
        "pos_btn_seat": posiciones.get("btn_seat") or "",
        "pos_sb_seat": posiciones.get("sb_seat") or "",
        "pos_bb_seat": posiciones.get("bb_seat") or "",
        "pos_dealer_seat": posiciones.get("dealer_seat") or "",
        "pos_method": posiciones.get("method") or "",
        "pos_errors_json": to_json_list(posiciones.get("errors") or []),
        "pos_debug_json": to_json(posiciones.get("debug") or {}),
        "posiciones_json": to_json(posiciones),
    }
