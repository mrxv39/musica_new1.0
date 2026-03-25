"""
Tests for modules.ocr.bets.bets_correction — XML-based bet correction.
"""

import json
import sqlite3

from modules.ocr.bets.bets_correction import correct_bets_via_xml


def _setup_schema(conn):
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS hands (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tournament_id INTEGER,
            room TEXT NOT NULL DEFAULT '',
            hero TEXT NOT NULL DEFAULT '',
            gamecode TEXT NOT NULL DEFAULT '',
            players_json TEXT NOT NULL DEFAULT '',
            created_at TEXT DEFAULT (datetime('now')),
            UNIQUE(room, hero, gamecode)
        );
        CREATE TABLE IF NOT EXISTS actions_real (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            hand_id INTEGER NOT NULL,
            gamecode TEXT NOT NULL,
            round_no INTEGER NOT NULL,
            action_no INTEGER NOT NULL,
            player TEXT NOT NULL,
            type_id INTEGER NOT NULL,
            type_name TEXT NOT NULL,
            sum_chips REAL NOT NULL DEFAULT 0,
            sum_bb REAL NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
    """)


def _insert_hand_with_actions(conn, hand_id, gamecode, villain_names, actions):
    """
    actions: list of (player, type_name, sum_bb, round_no, action_no)
    """
    players = [{"name": "xavieeee2", "chips": 500, "dealer": "1", "win": "0"}]
    for vn in villain_names:
        players.append({"name": vn, "chips": 500, "dealer": "0", "win": "0"})
    pj = json.dumps({"players": players})

    conn.execute(
        "INSERT INTO hands (id, gamecode, room, hero, players_json) VALUES (?, ?, 'cp', 'xavieeee2', ?)",
        (hand_id, gamecode, pj),
    )
    for player, type_name, sum_bb, round_no, action_no in actions:
        conn.execute(
            "INSERT INTO actions_real (hand_id, gamecode, round_no, action_no, player, type_id, type_name, sum_bb) "
            "VALUES (?, ?, ?, ?, ?, 0, ?, ?)",
            (hand_id, gamecode, round_no, action_no, player, type_name, sum_bb),
        )
    conn.commit()


class TestCorrectBetsViaXml:
    def test_corrects_villain_bet_in_hu(self, temp_db_path):
        """HU: OCR reads p3=27, XML says villain bet 22.37 at the state where hero=1.0."""
        conn = sqlite3.connect(str(temp_db_path))
        _setup_schema(conn)
        _insert_hand_with_actions(conn, 1, "GC1", ["Azenor"], [
            ("xavieeee2", "POST_SB", 0.5, 0, 1),
            ("Azenor", "POST_BB", 1.0, 0, 2),
            ("xavieeee2", "CALL", 0.5, 1, 3),
            ("Azenor", "RAISE", 21.37, 1, 4),
            ("Azenor", "FOLD", 0.0, 1, 5),
        ])

        ocr_bets = {"ok": True, "p1": 1.0, "p2": 0.0, "p3": 27.0}
        pj = conn.execute("SELECT players_json FROM hands WHERE id=1").fetchone()[0]

        result = correct_bets_via_xml(ocr_bets, 1, pj, conn)

        assert result is not None
        assert result["p1"] == 1.0
        assert result["p2"] == 22.37  # villain corrected
        assert result["correction"] == "xml_actions"

    def test_corrects_3handed_bets(self, temp_db_path):
        """3-handed: OCR reads p2=0.5, p3=16.0 — XML says Gavron3 bet 17.8 at hero=2.0."""
        conn = sqlite3.connect(str(temp_db_path))
        _setup_schema(conn)
        _insert_hand_with_actions(conn, 1, "GC2", ["Gavron3", "RufusBalotelli"], [
            ("RufusBalotelli", "POST_SB", 0.5, 0, 1),
            ("xavieeee2", "POST_BB", 1.0, 0, 2),
            ("Gavron3", "RAISE", 2.0, 1, 3),
            ("xavieeee2", "CALL", 1.0, 1, 4),
            ("Gavron3", "RAISE", 15.8, 1, 5),
        ])

        # OCR reads p3=16.0 (close to 17.8), should snap to the state with Gavron3=17.8
        ocr_bets = {"ok": True, "p1": 2.0, "p2": 0.5, "p3": 16.0}
        pj = conn.execute("SELECT players_json FROM hands WHERE id=1").fetchone()[0]

        result = correct_bets_via_xml(ocr_bets, 1, pj, conn)

        assert result is not None
        assert result["p1"] == 2.0
        assert result["p2"] == 17.8  # Gavron3 corrected
        assert result["p3"] == 0.5   # RufusBalotelli kept

    def test_returns_none_when_no_hand_id(self, temp_db_path):
        conn = sqlite3.connect(str(temp_db_path))
        _setup_schema(conn)

        result = correct_bets_via_xml({"p1": 1.0}, 0, "", conn)
        assert result is None

    def test_returns_none_when_p1_doesnt_match(self, temp_db_path):
        """If hero bet doesn't match any action state, return None."""
        conn = sqlite3.connect(str(temp_db_path))
        _setup_schema(conn)
        _insert_hand_with_actions(conn, 1, "GC3", ["Villain"], [
            ("xavieeee2", "POST_SB", 0.5, 0, 1),
            ("Villain", "POST_BB", 1.0, 0, 2),
        ])

        ocr_bets = {"ok": True, "p1": 99.0, "p2": 0.0, "p3": 0.0}
        pj = conn.execute("SELECT players_json FROM hands WHERE id=1").fetchone()[0]

        result = correct_bets_via_xml(ocr_bets, 1, pj, conn)
        assert result is None

    def test_returns_none_when_no_actions(self, temp_db_path):
        conn = sqlite3.connect(str(temp_db_path))
        _setup_schema(conn)
        pj = json.dumps({"players": [{"name": "xavieeee2"}, {"name": "V"}]})
        conn.execute("INSERT INTO hands (id, gamecode, room, hero, players_json) VALUES (1, 'GC4', 'cp', 'xavieeee2', ?)", (pj,))
        conn.commit()

        result = correct_bets_via_xml({"p1": 1.0}, 1, pj, conn)
        assert result is None

    def test_preserves_original_fields(self, temp_db_path):
        """Corrected result should keep original ok, raw, method etc."""
        conn = sqlite3.connect(str(temp_db_path))
        _setup_schema(conn)
        _insert_hand_with_actions(conn, 1, "GC5", ["V1"], [
            ("V1", "POST_SB", 0.5, 0, 1),
            ("xavieeee2", "POST_BB", 1.0, 0, 2),
        ])

        ocr_bets = {"ok": True, "p1": 1.0, "p2": 0.0, "p3": 5.0, "raw": {"p1": "1"}, "method": {"p1": "otsu"}}
        pj = conn.execute("SELECT players_json FROM hands WHERE id=1").fetchone()[0]

        result = correct_bets_via_xml(ocr_bets, 1, pj, conn)

        assert result["ok"] is True
        assert result["raw"] == {"p1": "1"}
        assert result["method"] == {"p1": "otsu"}

    def test_hero_bet_corrected_too(self, temp_db_path):
        """Hero bet is snapped to the closest matching state."""
        conn = sqlite3.connect(str(temp_db_path))
        _setup_schema(conn)
        _insert_hand_with_actions(conn, 1, "GC6", ["V1"], [
            ("V1", "POST_SB", 0.5, 0, 1),
            ("xavieeee2", "POST_BB", 1.0, 0, 2),
            ("V1", "RAISE", 2.5, 1, 3),
            ("xavieeee2", "CALL", 2.0, 1, 4),
        ])

        # OCR reads hero=2.8 (close to 3.0 = 1.0 + 2.0)
        ocr_bets = {"ok": True, "p1": 2.8, "p2": 0.0, "p3": 0.0}
        pj = conn.execute("SELECT players_json FROM hands WHERE id=1").fetchone()[0]

        result = correct_bets_via_xml(ocr_bets, 1, pj, conn)

        assert result is not None
        assert result["p1"] == 3.0  # corrected from 2.8 to 3.0
        assert result["p2"] == 3.0  # V1 total = 0.5 + 2.5 = 3.0
