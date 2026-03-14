# C:\Users\Usuario\Desktop\proyectos\poker_boss\modules\db\schema.py

# NOTA:
# - Aquí solo dejamos CREATE TABLE (sin índices que dependan de columnas),
#   porque podemos estar migrando desde esquemas antiguos.
# - Los índices se crean desde init_db() cuando ya sabemos que las columnas existen.

SCHEMA_TABLES_SQL = """
-- =========================
-- Player classification table for villano OCR
-- =========================
CREATE TABLE IF NOT EXISTS players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    tipo TEXT NOT NULL DEFAULT 'fish',
    created_at TEXT DEFAULT (datetime('now'))
);
PRAGMA journal_mode=WAL;
PRAGMA synchronous=NORMAL;

-- =========================
-- Legacy table (tests antiguos)
-- =========================
CREATE TABLE IF NOT EXISTS hands (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fingerprint TEXT NOT NULL UNIQUE,
    data_json TEXT DEFAULT ''
    -- created_at_ms puede no existir en instalaciones antiguas; se añade por migración
);

-- =========================
-- Nuevo modelo (observaciones OCR + verdad XML + links)
-- =========================
CREATE TABLE IF NOT EXISTS hands_obs (
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

    -- 🆕 denormalized bets (for UI sorting/filtering)
    p2bet REAL DEFAULT NULL,
    p3bet REAL DEFAULT NULL,
    p1_se_bb REAL DEFAULT NULL,
    captured_gamecode TEXT DEFAULT NULL,

    frame_ref TEXT DEFAULT '',
    created_at_ms INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS hands_xml (
    gamecode TEXT PRIMARY KEY,
    sessioncode TEXT DEFAULT '',
    startdate TEXT DEFAULT '',
    smallblind TEXT DEFAULT '',
    bigblind TEXT DEFAULT '',

    hero_reg_code TEXT DEFAULT '',
    hero_name TEXT DEFAULT '',
    hero_seat TEXT DEFAULT '',
    hero_cards TEXT DEFAULT '',

    board_flop TEXT DEFAULT '',
    board_turn TEXT DEFAULT '',
    board_river TEXT DEFAULT '',

    players_json TEXT DEFAULT '',
    actions_json TEXT DEFAULT '',

    created_at_ms INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS tournaments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room TEXT NOT NULL DEFAULT '',
    hero TEXT NOT NULL DEFAULT '',
    tournament_path TEXT NOT NULL DEFAULT '',
    source_file TEXT NOT NULL DEFAULT '',
    client_version TEXT NOT NULL DEFAULT '',
    mode TEXT NOT NULL DEFAULT '',
    gametype TEXT NOT NULL DEFAULT '',
    tablename TEXT NOT NULL DEFAULT '',
    tournament_currency TEXT NOT NULL DEFAULT '',
    duration TEXT NOT NULL DEFAULT '',
    game_count TEXT NOT NULL DEFAULT '',
    startdate TEXT NOT NULL DEFAULT '',
    currency TEXT NOT NULL DEFAULT '',
    nickname TEXT NOT NULL DEFAULT '',
    bets TEXT NOT NULL DEFAULT '',
    wins TEXT NOT NULL DEFAULT '',
    chipsin TEXT NOT NULL DEFAULT '',
    chipsout TEXT NOT NULL DEFAULT '',
    statuspoints TEXT NOT NULL DEFAULT '',
    awardpoints TEXT NOT NULL DEFAULT '',
    ipoints TEXT NOT NULL DEFAULT '',
    tablesize TEXT NOT NULL DEFAULT '',
    tournamentcode TEXT NOT NULL DEFAULT '',
    tournamentname TEXT NOT NULL DEFAULT '',
    rewarddrawn TEXT NOT NULL DEFAULT '',
    place TEXT NOT NULL DEFAULT '',
    buyin TEXT NOT NULL DEFAULT '',
    totalbuyin TEXT NOT NULL DEFAULT '',
    win TEXT NOT NULL DEFAULT '',
    smallblind TEXT NOT NULL DEFAULT '',
    bigblind TEXT NOT NULL DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(room, hero, source_file)
);

CREATE TABLE IF NOT EXISTS hand_links (
    link_id INTEGER PRIMARY KEY AUTOINCREMENT,
    obs_id INTEGER NOT NULL,
    gamecode TEXT NOT NULL,

    match_score REAL DEFAULT 0.0,
    match_method TEXT DEFAULT '',
    created_at_ms INTEGER DEFAULT 0,

    UNIQUE(obs_id),

    FOREIGN KEY(obs_id) REFERENCES hands_obs(obs_id),
    FOREIGN KEY(gamecode) REFERENCES hands_xml(gamecode)
);

-- =========================
-- Workers captures (dedupe persistente entre ticks / reinicios)
-- =========================
CREATE TABLE IF NOT EXISTS workers_captures (
    capture_id INTEGER PRIMARY KEY AUTOINCREMENT,
    mesa INTEGER NOT NULL DEFAULT 0,
    image_path TEXT DEFAULT '',
    final_image_path TEXT DEFAULT '',
    image_fingerprint TEXT NOT NULL,
    image_size_bytes INTEGER DEFAULT 0,
    status TEXT DEFAULT '',
    reason TEXT DEFAULT '',
    ocr_ok INTEGER DEFAULT 0,
    ocr_json TEXT DEFAULT '',
    created_at_ms INTEGER DEFAULT 0,
    updated_at_ms INTEGER DEFAULT 0
);
"""
