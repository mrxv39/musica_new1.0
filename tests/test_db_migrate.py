import sqlite3

from modules.db.migrate import init_db


def test_init_db_crea_workers_captures_y_columnas_ocr(temp_db_path):
    init_db()

    conn = sqlite3.connect(str(temp_db_path))
    try:
        tables = {
            r[0]
            for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
        }
        assert "workers_captures" in tables

        cols = [r[1] for r in conn.execute("PRAGMA table_info(workers_captures)").fetchall()]
        expected = {
            "capture_id",
            "ocr_ok",
            "ocr_json",
            "names_ok",
            "p2_name",
            "p3_name",
            "villano_ok",
            "stackefectivo_value",
            "bet_p1",
            "bet_p2",
            "bet_p3",
            "stack_p1",
            "stack_p2",
            "stack_p3",
            "table_players",
            "dealer_seat",
            "pos_p1",
            "pos_p2",
            "pos_p3",
        }
        assert expected.issubset(set(cols))
    finally:
        conn.close()


def test_init_db_es_idempotente(temp_db_path):
    init_db()
    init_db()

    conn = sqlite3.connect(str(temp_db_path))
    try:
        cols = [r[1] for r in conn.execute("PRAGMA table_info(workers_captures)").fetchall()]
        assert "ocr_json" in cols
        assert "dealer_seat" in cols
        assert "posiciones_json" in cols
    finally:
        conn.close()


def test_init_db_migra_schema_parcial_de_workers_captures(temp_db_path):
    conn = sqlite3.connect(str(temp_db_path))
    try:
        conn.execute(
            """
            CREATE TABLE workers_captures (
                capture_id INTEGER PRIMARY KEY AUTOINCREMENT,
                image_fingerprint TEXT NOT NULL
            )
            """
        )
        conn.commit()
    finally:
        conn.close()

    init_db()

    conn = sqlite3.connect(str(temp_db_path))
    try:
        cols = [r[1] for r in conn.execute("PRAGMA table_info(workers_captures)").fetchall()]
        assert "mesa" in cols
        assert "image_path" in cols
        assert "ocr_ok" in cols
        assert "ocr_json" in cols
        assert "names_ok" in cols
        assert "stack_p1" in cols
        assert "dealer_seat" in cols
        assert "pos_p1" in cols
    finally:
        conn.close()


def test_init_db_crea_indices_de_workers_captures(temp_db_path):
    init_db()

    conn = sqlite3.connect(str(temp_db_path))
    try:
        idxs = {
            r[0]
            for r in conn.execute(
                "SELECT name FROM sqlite_master WHERE type='index'"
            ).fetchall()
        }
        expected = {
            "idx_workers_captures_fp_time",
            "idx_workers_captures_mesa_time",
            "idx_workers_captures_status_time",
            "idx_workers_captures_ocr_ok_time",
            "idx_workers_captures_table_players_time",
            "idx_workers_captures_dealer_seat_time",
            "idx_workers_captures_pos_method_time",
        }
        assert expected.issubset(idxs)
    finally:
        conn.close()


def test_init_db_agrega_captured_gamecode_a_hands_obs(temp_db_path):
    init_db()

    conn = sqlite3.connect(str(temp_db_path))
    try:
        cols = [r[1] for r in conn.execute("PRAGMA table_info(spots)").fetchall()]
        assert "captured_gamecode" in cols
    finally:
        conn.close()


def test_init_db_crea_tabla_tournaments(temp_db_path):
    init_db()

    conn = sqlite3.connect(str(temp_db_path))
    try:
        tables = {
            r[0]
            for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
        }
        assert "tournaments" in tables

        cols = [r[1] for r in conn.execute("PRAGMA table_info(tournaments)").fetchall()]
        assert "source_file" in cols
        assert "tournamentcode" in cols
        assert "tournamentname" in cols
    finally:
        conn.close()


def test_init_db_migra_hands_con_tournament_id_si_existe(temp_db_path):
    conn = sqlite3.connect(str(temp_db_path))
    try:
        conn.execute(
            """
            CREATE TABLE hands (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                room TEXT NOT NULL,
                hero TEXT NOT NULL,
                gamecode TEXT NOT NULL
            )
            """
        )
        conn.commit()
    finally:
        conn.close()

    init_db()

    conn = sqlite3.connect(str(temp_db_path))
    try:
        cols = [r[1] for r in conn.execute("PRAGMA table_info(hands)").fetchall()]
        assert "tournament_id" in cols
    finally:
        conn.close()
