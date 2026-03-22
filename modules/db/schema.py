# C:\Users\Usuario\Desktop\proyectos\poker_boss\modules\db\schema.py

SCHEMA_TABLES_SQL = """
PRAGMA journal_mode=WAL;
PRAGMA synchronous=NORMAL;

-- =========================
-- Players (villano classification)
-- =========================
CREATE TABLE IF NOT EXISTS players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    tipo TEXT NOT NULL DEFAULT 'fish',
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
);

-- =========================
-- Hand-Players join (extracted from hands.players_json)
-- =========================
CREATE TABLE IF NOT EXISTS hand_players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hand_id INTEGER NOT NULL REFERENCES hands(id) ON DELETE CASCADE,
    player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    seat INTEGER DEFAULT 0,
    chips REAL DEFAULT 0,
    is_dealer INTEGER DEFAULT 0,
    win REAL DEFAULT 0,
    UNIQUE(hand_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_hand_players_hand ON hand_players(hand_id);
CREATE INDEX IF NOT EXISTS idx_hand_players_player ON hand_players(player_id);

-- =========================
-- Player aliases (OCR variants -> canonical player)
-- =========================
CREATE TABLE IF NOT EXISTS player_aliases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    alias TEXT UNIQUE NOT NULL,
    player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    source TEXT NOT NULL DEFAULT 'manual',
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_player_aliases_player ON player_aliases(player_id);

-- =========================
-- Spots (OCR observations from worker)
-- =========================
CREATE TABLE IF NOT EXISTS spots (
    obs_id INTEGER PRIMARY KEY AUTOINCREMENT,

    fingerprint TEXT NOT NULL UNIQUE,
    table_id TEXT DEFAULT '',
    detected_at_ms INTEGER DEFAULT 0,

    mano_raw TEXT DEFAULT '',
    hand_class TEXT DEFAULT '',
    time_str TEXT DEFAULT '',
    preflop_ok INTEGER DEFAULT 0,
    noboard_ok INTEGER DEFAULT 0,

    ocr_json TEXT DEFAULT '',

    p2bet REAL DEFAULT NULL,
    p3bet REAL DEFAULT NULL,
    p1_se_bb REAL DEFAULT NULL,
    captured_gamecode TEXT DEFAULT NULL,

    frame_ref TEXT DEFAULT '',
    created_at_ms INTEGER DEFAULT 0,
    hand_id INTEGER DEFAULT NULL
);

-- =========================
-- Mesa state (live time_active flag per mesa)
-- =========================
CREATE TABLE IF NOT EXISTS mesa_state (
    mesa INTEGER PRIMARY KEY,
    time_active INTEGER DEFAULT 0,
    updated_at_ms INTEGER DEFAULT 0
);

-- =========================
-- Hands real (imported from XML hand histories)
-- =========================
CREATE TABLE IF NOT EXISTS hands (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tournament_id INTEGER REFERENCES tournaments(id),
    room TEXT NOT NULL DEFAULT '',
    hero TEXT NOT NULL DEFAULT '',
    tournament_path TEXT NOT NULL DEFAULT '',
    source_file TEXT NOT NULL DEFAULT '',
    gamecode TEXT NOT NULL DEFAULT '',
    startdate TEXT NOT NULL DEFAULT '',
    sb REAL NOT NULL DEFAULT 0,
    bb REAL NOT NULL DEFAULT 0,
    hero_cards TEXT NOT NULL DEFAULT '',
    flop TEXT NOT NULL DEFAULT '',
    turn TEXT NOT NULL DEFAULT '',
    river TEXT NOT NULL DEFAULT '',
    players_json TEXT NOT NULL DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(room, hero, gamecode)
);

-- =========================
-- Tournaments (imported from XML)
-- =========================
CREATE TABLE IF NOT EXISTS tournaments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room TEXT NOT NULL DEFAULT '',
    hero TEXT NOT NULL DEFAULT '',
    tournament_path TEXT NOT NULL DEFAULT '',
    source_file TEXT NOT NULL DEFAULT '',
    tournamentcode TEXT NOT NULL DEFAULT '',
    tournamentname TEXT NOT NULL DEFAULT '',
    startdate TEXT NOT NULL DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(room, hero, source_file)
);

-- =========================
-- Spot strategies (imported from Excel)
-- =========================
-- =========================
-- Hand links (spot ↔ hand matching)
-- =========================
CREATE TABLE IF NOT EXISTS hand_links (
    link_id INTEGER PRIMARY KEY AUTOINCREMENT,
    obs_id INTEGER NOT NULL,
    spot_id INTEGER NOT NULL,
    gamecode TEXT NOT NULL DEFAULT '',
    match_score REAL DEFAULT 0,
    match_method TEXT DEFAULT '',
    created_at_ms INTEGER DEFAULT 0,
    UNIQUE(obs_id)
);

-- =========================
-- Spot strategies (imported from Excel)
-- =========================
CREATE TABLE IF NOT EXISTS spots_strategy_scopes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    spot_key TEXT NOT NULL,
    p2_tipo TEXT NOT NULL,
    p3_tipo TEXT NOT NULL,
    scope_se_min REAL NOT NULL,
    scope_se_max REAL NOT NULL,
    sheet_name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS spots_strategies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    spot_key TEXT NOT NULL,
    hand_range_name TEXT NOT NULL,
    move TEXT NOT NULL,
    bet_min REAL DEFAULT NULL,
    bet_max REAL DEFAULT NULL,
    hand_range TEXT DEFAULT '',
    stack_effective_min REAL NOT NULL,
    stack_effective_max REAL NOT NULL,
    p1_pos TEXT DEFAULT '',
    p2_pos TEXT DEFAULT '',
    p3_pos TEXT DEFAULT '',
    p2_tipo TEXT DEFAULT '',
    p3_tipo TEXT DEFAULT '',
    p1bet_min REAL DEFAULT NULL,
    p1bet_max REAL DEFAULT NULL,
    p2bet_min REAL DEFAULT NULL,
    p2bet_max REAL DEFAULT NULL,
    p3bet_min REAL DEFAULT NULL,
    p3bet_max REAL DEFAULT NULL,
    p2stack_min REAL DEFAULT NULL,
    p2stack_max REAL DEFAULT NULL,
    p3stack_min REAL DEFAULT NULL,
    p3stack_max REAL DEFAULT NULL
);

CREATE TABLE IF NOT EXISTS spots_strategies_nash (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    spot_key TEXT NOT NULL,
    hand_range_name TEXT NOT NULL,
    move TEXT NOT NULL,
    hand_class TEXT NOT NULL,
    stack_effective_min REAL NOT NULL,
    stack_effective_max REAL NOT NULL,
    p1_pos TEXT DEFAULT '',
    p2_pos TEXT DEFAULT '',
    p3_pos TEXT DEFAULT '',
    p2_tipo TEXT DEFAULT '',
    p3_tipo TEXT DEFAULT '',
    p1bet_min REAL DEFAULT NULL,
    p1bet_max REAL DEFAULT NULL,
    p2bet_min REAL DEFAULT NULL,
    p2bet_max REAL DEFAULT NULL,
    p3bet_min REAL DEFAULT NULL,
    p3bet_max REAL DEFAULT NULL,
    p2stack_min REAL DEFAULT NULL,
    p2stack_max REAL DEFAULT NULL,
    p3stack_min REAL DEFAULT NULL,
    p3stack_max REAL DEFAULT NULL
);

-- =========================
-- Workers captures (OCR audit per capture)
-- =========================
CREATE TABLE IF NOT EXISTS workers_captures (
    capture_id INTEGER PRIMARY KEY AUTOINCREMENT,
    mesa INTEGER DEFAULT 0,
    image_path TEXT DEFAULT '',
    final_image_path TEXT DEFAULT '',
    image_fingerprint TEXT NOT NULL,
    image_size_bytes INTEGER DEFAULT 0,
    status TEXT DEFAULT '',
    reason TEXT DEFAULT '',

    ocr_ok INTEGER DEFAULT 0,
    ocr_json TEXT DEFAULT '',
    ocr_errors_json TEXT DEFAULT '',

    names_ok INTEGER DEFAULT 0,
    p2_name TEXT DEFAULT '',
    p3_name TEXT DEFAULT '',
    names_errors_json TEXT DEFAULT '',
    names_json TEXT DEFAULT '',

    villano_ok INTEGER DEFAULT 0,
    villano_p2_name TEXT DEFAULT '',
    villano_p2_tipo TEXT DEFAULT '',
    villano_p3_name TEXT DEFAULT '',
    villano_p3_tipo TEXT DEFAULT '',
    villano_created_json TEXT DEFAULT '',
    villano_errors_json TEXT DEFAULT '',
    villano_json TEXT DEFAULT '',

    stackefectivo_ok INTEGER DEFAULT 0,
    stackefectivo_value REAL DEFAULT NULL,
    stackefectivo_raw TEXT DEFAULT '',
    stackefectivo_method TEXT DEFAULT '',
    stackefectivo_roi_json TEXT DEFAULT '',
    stackefectivo_error TEXT DEFAULT '',
    stackefectivo_json TEXT DEFAULT '',

    bets_ok INTEGER DEFAULT 0,
    bet_p1 REAL DEFAULT NULL,
    bet_p2 REAL DEFAULT NULL,
    bet_p3 REAL DEFAULT NULL,
    bet_raw_p1 TEXT DEFAULT '',
    bet_raw_p2 TEXT DEFAULT '',
    bet_raw_p3 TEXT DEFAULT '',
    bet_method_p1 TEXT DEFAULT '',
    bet_method_p2 TEXT DEFAULT '',
    bet_method_p3 TEXT DEFAULT '',
    bets_errors_json TEXT DEFAULT '',
    bets_json TEXT DEFAULT '',

    stacks_ok INTEGER DEFAULT 0,
    stack_p1 REAL DEFAULT NULL,
    stack_p2 REAL DEFAULT NULL,
    stack_p3 REAL DEFAULT NULL,
    stack_raw_p1 TEXT DEFAULT '',
    stack_raw_p2 TEXT DEFAULT '',
    stack_raw_p3 TEXT DEFAULT '',
    stack_method_p1 TEXT DEFAULT '',
    stack_method_p2 TEXT DEFAULT '',
    stack_method_p3 TEXT DEFAULT '',
    stacks_errors_json TEXT DEFAULT '',
    stacks_json TEXT DEFAULT '',

    table_state_ok INTEGER DEFAULT 0,
    table_players INTEGER DEFAULT 0,
    table_is_hu INTEGER DEFAULT 0,
    table_is_3h INTEGER DEFAULT 0,
    table_active_seats_json TEXT DEFAULT '',
    table_eliminated_seats_json TEXT DEFAULT '',
    table_state_method TEXT DEFAULT '',
    table_state_errors_json TEXT DEFAULT '',
    table_state_json TEXT DEFAULT '',

    dealer_ok INTEGER DEFAULT 0,
    dealer_seat INTEGER DEFAULT NULL,
    dealer_score REAL DEFAULT NULL,
    dealer_method TEXT DEFAULT '',
    dealer_errors_json TEXT DEFAULT '',
    dealer_debug_json TEXT DEFAULT '',
    dealer_json TEXT DEFAULT '',

    posiciones_ok INTEGER DEFAULT 0,
    pos_p1 TEXT DEFAULT '',
    pos_p2 TEXT DEFAULT '',
    pos_p3 TEXT DEFAULT '',
    pos_btn_seat INTEGER DEFAULT NULL,
    pos_sb_seat INTEGER DEFAULT NULL,
    pos_bb_seat INTEGER DEFAULT NULL,
    pos_dealer_seat INTEGER DEFAULT NULL,
    pos_method TEXT DEFAULT '',
    pos_errors_json TEXT DEFAULT '',
    pos_debug_json TEXT DEFAULT '',
    posiciones_json TEXT DEFAULT '',

    created_at_ms INTEGER DEFAULT 0,
    updated_at_ms INTEGER DEFAULT 0
);
"""
