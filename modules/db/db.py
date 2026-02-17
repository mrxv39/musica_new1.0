# C:\Users\Usuario\Desktop\proyectos\musica_new\modules\db\db.py

import os
import sqlite3
import threading
import time
from typing import Any, Dict, Optional, Sequence

from .schema import SCHEMA_TABLES_SQL

_LOCK = threading.Lock()


def _now_ms() -> int:
    return int(time.time() * 1000)


def _project_root() -> str:
    # .../modules/db/db.py -> .../ (repo root)
    return os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))


def get_db_path() -> str:
    """
    Default: <repo_root>/data/musica_new.db
    Override with env: MUSICA_DB_PATH
    """
    env = os.environ.get("MUSICA_DB_PATH", "").strip()
    if env:
        return env

    root = _project_root()
    data_dir = os.path.join(root, "data")
    os.makedirs(data_dir, exist_ok=True)
    return os.path.join(data_dir, "musica_new.db")


def get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(get_db_path(), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def _table_columns(conn: sqlite3.Connection, table: str) -> Sequence[str]:
    cur = conn.cursor()
    cur.execute(f"PRAGMA table_info({table})")
    return [r[1] for r in cur.fetchall()]  # name is index 1


def _add_column_if_missing(conn: sqlite3.Connection, table: str, col_name: str, col_def: str) -> None:
    cols = _table_columns(conn, table)
    if col_name not in cols:
        cur = conn.cursor()
        cur.execute(f"ALTER TABLE {table} ADD COLUMN {col_name} {col_def}")


def _create_indexes(conn: sqlite3.Connection) -> None:
    cur = conn.cursor()

    # legacy
    cur.execute("CREATE INDEX IF NOT EXISTS idx_hands_created_at ON hands(created_at_ms DESC)")

    # new
    cur.execute("CREATE INDEX IF NOT EXISTS idx_hands_obs_table_time ON hands_obs(table_id, detected_at_ms DESC)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_hands_xml_session_startdate ON hands_xml(sessioncode, startdate)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_hand_links_gamecode ON hand_links(gamecode)")


def init_db() -> None:
    """
    - Crea tablas si no existen
    - Migra tablas antiguas añadiendo columnas que falten
    - Crea índices al final (cuando las columnas ya existen)
    """
    with _LOCK:
        conn = get_conn()
        try:
            # 1) crear tablas base
            conn.executescript(SCHEMA_TABLES_SQL)

            # 2) migraciones (por si la tabla hands existía sin created_at_ms)
            _add_column_if_missing(conn, "hands", "created_at_ms", "INTEGER DEFAULT 0")
            # por compatibilidad: si alguna instalación antigua no tenía data_json
            _add_column_if_missing(conn, "hands", "data_json", "TEXT DEFAULT ''")

            # 3) índices (después de migrar)
            _create_indexes(conn)

            conn.commit()
        finally:
            conn.close()


# =========================
# Legacy API (para tests antiguos)
# =========================

def insert_hand(fingerprint: str, data_json: str) -> Optional[int]:
    """
    Inserta en tabla legacy `hands` idempotente por fingerprint.
    Devuelve el id existente o el nuevo.
    """
    init_db()
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            """
            INSERT OR IGNORE INTO hands (fingerprint, data_json, created_at_ms)
            VALUES (?, ?, ?)
            """,
            (fingerprint, data_json or "", _now_ms()),
        )
        conn.commit()

        cur.execute("SELECT id FROM hands WHERE fingerprint = ?", (fingerprint,))
        row = cur.fetchone()
        return int(row["id"]) if row else None
    finally:
        conn.close()


def get_hand_by_fingerprint(fingerprint: str) -> Optional[Dict[str, Any]]:
    init_db()
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute("SELECT * FROM hands WHERE fingerprint = ?", (fingerprint,))
        row = cur.fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


# =========================
# New API (OCR obs / XML truth / links)
# =========================

def insert_obs(
    *,
    fingerprint: str,
    table_id: str = "",
    detected_at_ms: int = 0,
    mano_raw: str = "",
    hand_class: str = "",
    time_str: str = "",
    preflop_ok: bool = False,
    noboard_ok: bool = False,
    ocr_json: str = "",
    frame_ref: str = "",
) -> Optional[int]:
    init_db()
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            """
            INSERT OR IGNORE INTO hands_obs
            (fingerprint, table_id, detected_at_ms, mano_raw, hand_class, time_str,
             preflop_ok, noboard_ok, ocr_json, frame_ref, created_at_ms)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                fingerprint,
                table_id or "",
                int(detected_at_ms) if detected_at_ms else 0,
                mano_raw or "",
                hand_class or "",
                time_str or "",
                1 if preflop_ok else 0,
                1 if noboard_ok else 0,
                ocr_json or "",
                frame_ref or "",
                _now_ms(),
            ),
        )
        conn.commit()

        cur.execute("SELECT obs_id FROM hands_obs WHERE fingerprint = ?", (fingerprint,))
        row = cur.fetchone()
        return int(row["obs_id"]) if row else None
    finally:
        conn.close()


def get_obs_by_fingerprint(fingerprint: str) -> Optional[Dict[str, Any]]:
    init_db()
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute("SELECT * FROM hands_obs WHERE fingerprint = ?", (fingerprint,))
        row = cur.fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def upsert_xml_game(
    *,
    gamecode: str,
    sessioncode: str = "",
    startdate: str = "",
    smallblind: str = "",
    bigblind: str = "",
    hero_reg_code: str = "",
    hero_name: str = "",
    hero_seat: str = "",
    hero_cards: str = "",
    board_flop: str = "",
    board_turn: str = "",
    board_river: str = "",
    players_json: str = "",
    actions_json: str = "",
) -> Optional[str]:
    if not gamecode:
        return None

    init_db()
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO hands_xml
            (gamecode, sessioncode, startdate, smallblind, bigblind,
             hero_reg_code, hero_name, hero_seat, hero_cards,
             board_flop, board_turn, board_river,
             players_json, actions_json, created_at_ms)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(gamecode) DO UPDATE SET
             sessioncode=excluded.sessioncode,
             startdate=excluded.startdate,
             smallblind=excluded.smallblind,
             bigblind=excluded.bigblind,
             hero_reg_code=excluded.hero_reg_code,
             hero_name=excluded.hero_name,
             hero_seat=excluded.hero_seat,
             hero_cards=excluded.hero_cards,
             board_flop=excluded.board_flop,
             board_turn=excluded.board_turn,
             board_river=excluded.board_river,
             players_json=excluded.players_json,
             actions_json=excluded.actions_json
            """,
            (
                gamecode,
                sessioncode or "",
                startdate or "",
                smallblind or "",
                bigblind or "",
                hero_reg_code or "",
                hero_name or "",
                hero_seat or "",
                hero_cards or "",
                board_flop or "",
                board_turn or "",
                board_river or "",
                players_json or "",
                actions_json or "",
                _now_ms(),
            ),
        )
        conn.commit()
        return gamecode
    finally:
        conn.close()


def get_xml_by_gamecode(gamecode: str) -> Optional[Dict[str, Any]]:
    init_db()
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute("SELECT * FROM hands_xml WHERE gamecode = ?", (gamecode,))
        row = cur.fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def link_obs_to_game(
    *,
    obs_id: int,
    gamecode: str,
    match_score: float = 0.0,
    match_method: str = "",
) -> Optional[int]:
    if not obs_id or not gamecode:
        return None

    init_db()
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            """
            INSERT OR IGNORE INTO hand_links
            (obs_id, gamecode, match_score, match_method, created_at_ms)
            VALUES (?, ?, ?, ?, ?)
            """,
            (int(obs_id), gamecode, float(match_score), match_method or "", _now_ms()),
        )
        conn.commit()

        cur.execute("SELECT link_id FROM hand_links WHERE obs_id = ?", (int(obs_id),))
        row = cur.fetchone()
        return int(row["link_id"]) if row else None
    finally:
        conn.close()
