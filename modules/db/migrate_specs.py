from __future__ import annotations

HANDS_COLUMNS = [
    ("created_at_ms", "INTEGER DEFAULT 0"),
    ("data_json", "TEXT DEFAULT ''"),
]

HANDS_OBS_COLUMNS = [
    ("p2bet", "REAL DEFAULT NULL"),
    ("p3bet", "REAL DEFAULT NULL"),
    ("p1_se_bb", "REAL DEFAULT NULL"),
    ("captured_gamecode", "TEXT DEFAULT NULL"),
    ("frame_ref", "TEXT DEFAULT ''"),
]

WORKERS_CAPTURES_COLUMNS = [
    # base
    ("mesa", "INTEGER NOT NULL DEFAULT 0"),
    ("image_path", "TEXT DEFAULT ''"),
    ("final_image_path", "TEXT DEFAULT ''"),
    ("image_fingerprint", "TEXT DEFAULT ''"),
    ("image_size_bytes", "INTEGER DEFAULT 0"),
    ("status", "TEXT DEFAULT ''"),
    ("reason", "TEXT DEFAULT ''"),
    ("ocr_ok", "INTEGER DEFAULT 0"),
    ("ocr_json", "TEXT DEFAULT ''"),
    ("ocr_errors_json", "TEXT DEFAULT ''"),
    ("created_at_ms", "INTEGER DEFAULT 0"),
    ("updated_at_ms", "INTEGER DEFAULT 0"),

    # names
    ("names_ok", "INTEGER DEFAULT 0"),
    ("p2_name", "TEXT DEFAULT ''"),
    ("p3_name", "TEXT DEFAULT ''"),
    ("names_errors_json", "TEXT DEFAULT ''"),
    ("names_json", "TEXT DEFAULT ''"),

    # villano
    ("villano_ok", "INTEGER DEFAULT 0"),
    ("villano_p2_name", "TEXT DEFAULT ''"),
    ("villano_p2_tipo", "TEXT DEFAULT ''"),
    ("villano_p3_name", "TEXT DEFAULT ''"),
    ("villano_p3_tipo", "TEXT DEFAULT ''"),
    ("villano_created_json", "TEXT DEFAULT ''"),
    ("villano_errors_json", "TEXT DEFAULT ''"),
    ("villano_json", "TEXT DEFAULT ''"),

    # stack efectivo
    ("stackefectivo_ok", "INTEGER DEFAULT 0"),
    ("stackefectivo_value", "REAL DEFAULT NULL"),
    ("stackefectivo_raw", "TEXT DEFAULT ''"),
    ("stackefectivo_method", "TEXT DEFAULT ''"),
    ("stackefectivo_roi_json", "TEXT DEFAULT ''"),
    ("stackefectivo_error", "TEXT DEFAULT ''"),
    ("stackefectivo_json", "TEXT DEFAULT ''"),

    # bets
    ("bets_ok", "INTEGER DEFAULT 0"),
    ("bet_p1", "REAL DEFAULT NULL"),
    ("bet_p2", "REAL DEFAULT NULL"),
    ("bet_p3", "REAL DEFAULT NULL"),
    ("bet_raw_p1", "TEXT DEFAULT ''"),
    ("bet_raw_p2", "TEXT DEFAULT ''"),
    ("bet_raw_p3", "TEXT DEFAULT ''"),
    ("bet_method_p1", "TEXT DEFAULT ''"),
    ("bet_method_p2", "TEXT DEFAULT ''"),
    ("bet_method_p3", "TEXT DEFAULT ''"),
    ("bets_errors_json", "TEXT DEFAULT ''"),
    ("bets_json", "TEXT DEFAULT ''"),

    # stacks
    ("stacks_ok", "INTEGER DEFAULT 0"),
    ("stack_p1", "REAL DEFAULT NULL"),
    ("stack_p2", "REAL DEFAULT NULL"),
    ("stack_p3", "REAL DEFAULT NULL"),
    ("stack_raw_p1", "TEXT DEFAULT ''"),
    ("stack_raw_p2", "TEXT DEFAULT ''"),
    ("stack_raw_p3", "TEXT DEFAULT ''"),
    ("stack_method_p1", "TEXT DEFAULT ''"),
    ("stack_method_p2", "TEXT DEFAULT ''"),
    ("stack_method_p3", "TEXT DEFAULT ''"),
    ("stacks_errors_json", "TEXT DEFAULT ''"),
    ("stacks_json", "TEXT DEFAULT ''"),

    # table_state
    ("table_state_ok", "INTEGER DEFAULT 0"),
    ("table_players", "INTEGER DEFAULT NULL"),
    ("table_is_hu", "INTEGER DEFAULT 0"),
    ("table_is_3h", "INTEGER DEFAULT 0"),
    ("table_active_seats_json", "TEXT DEFAULT ''"),
    ("table_eliminated_seats_json", "TEXT DEFAULT ''"),
    ("table_state_method", "TEXT DEFAULT ''"),
    ("table_state_errors_json", "TEXT DEFAULT ''"),
    ("table_state_json", "TEXT DEFAULT ''"),

    # dealer
    ("dealer_ok", "INTEGER DEFAULT 0"),
    ("dealer_seat", "TEXT DEFAULT ''"),
    ("dealer_score", "REAL DEFAULT NULL"),
    ("dealer_method", "TEXT DEFAULT ''"),
    ("dealer_errors_json", "TEXT DEFAULT ''"),
    ("dealer_debug_json", "TEXT DEFAULT ''"),
    ("dealer_json", "TEXT DEFAULT ''"),

    # posiciones
    ("posiciones_ok", "INTEGER DEFAULT 0"),
    ("pos_p1", "TEXT DEFAULT ''"),
    ("pos_p2", "TEXT DEFAULT ''"),
    ("pos_p3", "TEXT DEFAULT ''"),
    ("pos_btn_seat", "TEXT DEFAULT ''"),
    ("pos_sb_seat", "TEXT DEFAULT ''"),
    ("pos_bb_seat", "TEXT DEFAULT ''"),
    ("pos_dealer_seat", "TEXT DEFAULT ''"),
    ("pos_method", "TEXT DEFAULT ''"),
    ("pos_errors_json", "TEXT DEFAULT ''"),
    ("pos_debug_json", "TEXT DEFAULT ''"),
    ("posiciones_json", "TEXT DEFAULT ''"),
]

INDEX_SQLS = [
    "CREATE INDEX IF NOT EXISTS idx_hands_created_at ON hands(created_at_ms DESC)",
    "CREATE INDEX IF NOT EXISTS idx_hands_obs_table_time ON hands_obs(table_id, detected_at_ms DESC)",
    "CREATE INDEX IF NOT EXISTS idx_hands_xml_session_startdate ON hands_xml(sessioncode, startdate)",
    "CREATE INDEX IF NOT EXISTS idx_hand_links_gamecode ON hand_links(gamecode)",
    "CREATE INDEX IF NOT EXISTS idx_workers_captures_fp_time ON workers_captures(image_fingerprint, created_at_ms DESC)",
    "CREATE INDEX IF NOT EXISTS idx_workers_captures_mesa_time ON workers_captures(mesa, created_at_ms DESC)",
    "CREATE INDEX IF NOT EXISTS idx_workers_captures_status_time ON workers_captures(status, created_at_ms DESC)",
    "CREATE INDEX IF NOT EXISTS idx_workers_captures_ocr_ok_time ON workers_captures(ocr_ok, created_at_ms DESC)",
    "CREATE INDEX IF NOT EXISTS idx_workers_captures_table_players_time ON workers_captures(table_players, created_at_ms DESC)",
    "CREATE INDEX IF NOT EXISTS idx_workers_captures_dealer_seat_time ON workers_captures(dealer_seat, created_at_ms DESC)",
    "CREATE INDEX IF NOT EXISTS idx_workers_captures_pos_method_time ON workers_captures(pos_method, created_at_ms DESC)",
]
