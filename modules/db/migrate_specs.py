from __future__ import annotations

SPOTS_COLUMNS = [
    ("p2bet", "REAL DEFAULT NULL"),
    ("p3bet", "REAL DEFAULT NULL"),
    ("p1_se_bb", "REAL DEFAULT NULL"),
    ("captured_gamecode", "TEXT DEFAULT NULL"),
    ("frame_ref", "TEXT DEFAULT ''"),
    ("review_status", "TEXT DEFAULT NULL"),
    ("hand_id", "INTEGER DEFAULT NULL"),
]

INDEX_SQLS = [
    "CREATE INDEX IF NOT EXISTS idx_spots_table_time ON spots(table_id, detected_at_ms DESC)",
    "CREATE INDEX IF NOT EXISTS idx_spots_fingerprint ON spots(fingerprint)",

    # Spot strategies
    "CREATE INDEX IF NOT EXISTS idx_spots_strategy_scopes_lookup ON spots_strategy_scopes(spot_key, p2_tipo, p3_tipo, scope_se_min, scope_se_max)",
    "CREATE INDEX IF NOT EXISTS idx_spots_strategies_lookup ON spots_strategies(spot_key, p2_tipo, p3_tipo, stack_effective_min, stack_effective_max)",
    "CREATE INDEX IF NOT EXISTS idx_spots_strategies_nash_lookup ON spots_strategies_nash(spot_key, p2_tipo, p3_tipo, hand_class, stack_effective_min, stack_effective_max)",

    # Workers captures indices
    "CREATE INDEX IF NOT EXISTS idx_workers_captures_fp_time ON workers_captures(image_fingerprint, created_at_ms)",
    "CREATE INDEX IF NOT EXISTS idx_workers_captures_mesa_time ON workers_captures(mesa, created_at_ms)",
    "CREATE INDEX IF NOT EXISTS idx_workers_captures_status_time ON workers_captures(status, created_at_ms)",
    "CREATE INDEX IF NOT EXISTS idx_workers_captures_ocr_ok_time ON workers_captures(ocr_ok, created_at_ms)",
    "CREATE INDEX IF NOT EXISTS idx_workers_captures_table_players_time ON workers_captures(table_players, created_at_ms)",
    "CREATE INDEX IF NOT EXISTS idx_workers_captures_dealer_seat_time ON workers_captures(dealer_seat, created_at_ms)",
    "CREATE INDEX IF NOT EXISTS idx_workers_captures_pos_method_time ON workers_captures(posiciones_ok, created_at_ms)",
]
