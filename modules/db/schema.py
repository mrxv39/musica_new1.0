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
    created_at TEXT DEFAULT (datetime('now'))
);

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
    created_at_ms INTEGER DEFAULT 0
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
"""
