import sqlite3

from modules.ocr.villano import classify_villano


def test_classify_villano_crea_players_si_no_existe(temp_db_path):
    out = classify_villano(
        image_path="fake.bmp",
        p2_name="Alpha",
        p3_name="Beta",
    )

    assert out["ok"] is True

    conn = sqlite3.connect(str(temp_db_path))
    try:
        row = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='players'"
        ).fetchone()
        assert row is not None
    finally:
        conn.close()


def test_classify_villano_inserta_jugador_nuevo_como_fish(temp_db_path):
    out = classify_villano(
        image_path="fake.bmp",
        p2_name="NuevoVillano",
        p3_name="",
    )

    assert out["ok"] is True
    assert out["p2"]["name"] == "NuevoVillano"
    assert out["p2"]["tipo"] == "fish"

    conn = sqlite3.connect(str(temp_db_path))
    try:
        row = conn.execute(
            "SELECT name, tipo FROM players WHERE name=?",
            ("NuevoVillano",),
        ).fetchone()
        assert row == ("NuevoVillano", "fish")
    finally:
        conn.close()


def test_classify_villano_reutiliza_jugador_existente(temp_db_path):
    conn = sqlite3.connect(str(temp_db_path))
    try:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS players (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                tipo TEXT NOT NULL DEFAULT 'fish',
                created_at TEXT DEFAULT (datetime('now'))
            )
            """
        )
        conn.execute(
            "INSERT INTO players (name, tipo) VALUES (?, ?)",
            ("RegExistente", "reg"),
        )
        conn.commit()
    finally:
        conn.close()

    out = classify_villano(
        image_path="fake.bmp",
        p2_name="RegExistente",
        p3_name="",
    )

    assert out["ok"] is True
    assert out["p2"]["name"] == "RegExistente"
    assert out["p2"]["tipo"] == "reg"

    conn = sqlite3.connect(str(temp_db_path))
    try:
        count = conn.execute(
            "SELECT COUNT(*) FROM players WHERE name=?",
            ("RegExistente",),
        ).fetchone()[0]
        assert count == 1
    finally:
        conn.close()
