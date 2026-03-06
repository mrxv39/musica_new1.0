from __future__ import annotations

from typing import Any, Dict, Tuple

from .migrate import now_ms


def build_worker_capture_ocr_params(
    *,
    capture_id: int,
    ocr_ok: bool,
    ocr_json: str,
    flat: Dict[str, Any],
) -> Tuple[Any, ...]:
    return (
        1 if ocr_ok else 0,
        ocr_json or "",
        flat["ocr_errors_json"],

        flat["names_ok"],
        flat["p2_name"],
        flat["p3_name"],
        flat["names_errors_json"],
        flat["names_json"],

        flat["villano_ok"],
        flat["villano_p2_name"],
        flat["villano_p2_tipo"],
        flat["villano_p3_name"],
        flat["villano_p3_tipo"],
        flat["villano_created_json"],
        flat["villano_errors_json"],
        flat["villano_json"],

        flat["stackefectivo_ok"],
        flat["stackefectivo_value"],
        flat["stackefectivo_raw"],
        flat["stackefectivo_method"],
        flat["stackefectivo_roi_json"],
        flat["stackefectivo_error"],
        flat["stackefectivo_json"],

        flat["bets_ok"],
        flat["bet_p1"],
        flat["bet_p2"],
        flat["bet_p3"],
        flat["bet_raw_p1"],
        flat["bet_raw_p2"],
        flat["bet_raw_p3"],
        flat["bet_method_p1"],
        flat["bet_method_p2"],
        flat["bet_method_p3"],
        flat["bets_errors_json"],
        flat["bets_json"],

        flat["stacks_ok"],
        flat["stack_p1"],
        flat["stack_p2"],
        flat["stack_p3"],
        flat["stack_raw_p1"],
        flat["stack_raw_p2"],
        flat["stack_raw_p3"],
        flat["stack_method_p1"],
        flat["stack_method_p2"],
        flat["stack_method_p3"],
        flat["stacks_errors_json"],
        flat["stacks_json"],

        flat["table_state_ok"],
        flat["table_players"],
        flat["table_is_hu"],
        flat["table_is_3h"],
        flat["table_active_seats_json"],
        flat["table_eliminated_seats_json"],
        flat["table_state_method"],
        flat["table_state_errors_json"],
        flat["table_state_json"],

        flat["dealer_ok"],
        flat["dealer_seat"],
        flat["dealer_score"],
        flat["dealer_method"],
        flat["dealer_errors_json"],
        flat["dealer_debug_json"],
        flat["dealer_json"],

        flat["posiciones_ok"],
        flat["pos_p1"],
        flat["pos_p2"],
        flat["pos_p3"],
        flat["pos_btn_seat"],
        flat["pos_sb_seat"],
        flat["pos_bb_seat"],
        flat["pos_dealer_seat"],
        flat["pos_method"],
        flat["pos_errors_json"],
        flat["pos_debug_json"],
        flat["posiciones_json"],

        now_ms(),
        int(capture_id),
    )
