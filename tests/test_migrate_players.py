"""
Tests for modules.db.migrate_players — player migration from XML data.

Covers:
  - Table creation (hand_players, player_aliases)
  - Villain extraction from hands.players_json
  - Hero filtering
  - hand_players population with correct chips/dealer/win
  - Tipo preservation across migrations
  - Idempotency (running migration twice)
  - Edge cases (empty DB, corrupt JSON, missing hands)
"""

import json
import sqlite3

from modules.db.migrate_players import migrate_players, _parse_num


# ─── Helpers ───────────────────────────────────────────────────


def _create_schema(conn):
    """Minimal schema for migration tests."""
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS players (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            tipo TEXT NOT NULL DEFAULT 'fish',
            notes TEXT NOT NULL DEFAULT '',
            created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS tournaments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            room TEXT NOT NULL DEFAULT '',
            hero TEXT NOT NULL DEFAULT '',
            source_file TEXT NOT NULL DEFAULT '',
            created_at TEXT DEFAULT (datetime('now')),
            UNIQUE(room, hero, source_file)
        );
        CREATE TABLE IF NOT EXISTS hands (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tournament_id INTEGER REFERENCES tournaments(id),
            room TEXT NOT NULL DEFAULT '',
            hero TEXT NOT NULL DEFAULT '',
            gamecode TEXT NOT NULL DEFAULT '',
            players_json TEXT NOT NULL DEFAULT '',
            created_at TEXT DEFAULT (datetime('now')),
            UNIQUE(room, hero, gamecode)
        );
    """)


def _insert_hand(conn, gamecode, tournament_id, players_list):
    """Insert a hand with raw players list."""
    pj = json.dumps({"players": players_list})
    conn.execute(
        "INSERT INTO hands (gamecode, tournament_id, room, hero, players_json) VALUES (?, ?, 'cp', 'xavieeee2', ?)",
        (gamecode, tournament_id, pj),
    )


# ─── _parse_num ────────────────────────────────────────────────


class TestParseNum:
    def test_int(self):
        assert _parse_num(42) == 42.0

    def test_float(self):
        assert _parse_num(3.14) == 3.14

    def test_string(self):
        assert _parse_num("500") == 500.0

    def test_string_with_comma(self):
        assert _parse_num("1,020") == 1020.0

    def test_empty_string(self):
        assert _parse_num("") == 0.0

    def test_none(self):
        assert _parse_num(None) == 0.0

    def test_garbage(self):
        assert _parse_num("abc") == 0.0


# ─── Migration: table creation ────────────────────────────────


class TestMigrationTableCreation:
    def test_creates_hand_players_table(self, temp_db_path):
        conn = sqlite3.connect(str(temp_db_path))
        _create_schema(conn)
        conn.commit()

        migrate_players(conn, hero="xavieeee2")

        tables = {r[0] for r in conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
        ).fetchall()}
        assert "hand_players" in tables
        assert "player_aliases" in tables
        conn.close()

    def test_creates_indexes(self, temp_db_path):
        conn = sqlite3.connect(str(temp_db_path))
        _create_schema(conn)
        conn.commit()

        migrate_players(conn, hero="xavieeee2")

        indexes = {r[0] for r in conn.execute(
            "SELECT name FROM sqlite_master WHERE type='index'"
        ).fetchall()}
        assert "idx_hand_players_hand" in indexes
        assert "idx_hand_players_player" in indexes
        assert "idx_player_aliases_player" in indexes
        conn.close()

    def test_adds_notes_column_if_missing(self, temp_db_path):
        conn = sqlite3.connect(str(temp_db_path))
        # Create players without notes column
        conn.execute("""
            CREATE TABLE players (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                tipo TEXT NOT NULL DEFAULT 'fish',
                created_at TEXT DEFAULT (datetime('now'))
            )
        """)
        conn.execute("""
            CREATE TABLE hands (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tournament_id INTEGER,
                room TEXT NOT NULL DEFAULT '',
                hero TEXT NOT NULL DEFAULT '',
                gamecode TEXT NOT NULL DEFAULT '',
                players_json TEXT NOT NULL DEFAULT '',
                created_at TEXT DEFAULT (datetime('now')),
                UNIQUE(room, hero, gamecode)
            )
        """)
        conn.commit()

        migrate_players(conn, hero="xavieeee2")

        cols = {r[1] for r in conn.execute("PRAGMA table_info(players)").fetchall()}
        assert "notes" in cols
        conn.close()


# ─── Migration: villain extraction ────────────────────────────


class TestMigrationExtraction:
    def test_extracts_villains_from_xml(self, temp_db_path):
        conn = sqlite3.connect(str(temp_db_path))
        _create_schema(conn)
        conn.execute("INSERT INTO tournaments (id, room, hero, source_file) VALUES (1, 'cp', 'xavieeee2', 'f.xml')")
        _insert_hand(conn, "GC1", 1, [
            {"name": "xavieeee2", "chips": 500, "dealer": "1", "win": "0"},
            {"name": "VillainA", "chips": 400, "dealer": "0", "win": "100"},
        ])
        _insert_hand(conn, "GC2", 1, [
            {"name": "xavieeee2", "chips": 500, "dealer": "0", "win": "0"},
            {"name": "VillainB", "chips": 600, "dealer": "1", "win": "0"},
        ])
        conn.commit()

        migrate_players(conn, hero="xavieeee2")

        names = {r[0] for r in conn.execute("SELECT name FROM players").fetchall()}
        assert names == {"VillainA", "VillainB"}
        conn.close()

    def test_hero_is_excluded(self, temp_db_path):
        conn = sqlite3.connect(str(temp_db_path))
        _create_schema(conn)
        conn.execute("INSERT INTO tournaments (id, room, hero, source_file) VALUES (1, 'cp', 'xavieeee2', 'f.xml')")
        _insert_hand(conn, "GC1", 1, [
            {"name": "xavieeee2", "chips": 500, "dealer": "1", "win": "0"},
            {"name": "SomeVillain", "chips": 500, "dealer": "0", "win": "0"},
        ])
        conn.commit()

        migrate_players(conn, hero="xavieeee2")

        names = [r[0] for r in conn.execute("SELECT name FROM players").fetchall()]
        assert "xavieeee2" not in names
        assert "SomeVillain" in names
        conn.close()

    def test_deduplicates_across_hands(self, temp_db_path):
        conn = sqlite3.connect(str(temp_db_path))
        _create_schema(conn)
        conn.execute("INSERT INTO tournaments (id, room, hero, source_file) VALUES (1, 'cp', 'xavieeee2', 'f.xml')")
        # Same villain in 3 hands
        for i in range(3):
            _insert_hand(conn, f"GC{i}", 1, [
                {"name": "xavieeee2", "chips": 500, "dealer": "1", "win": "0"},
                {"name": "SameGuy", "chips": 500, "dealer": "0", "win": "0"},
            ])
        conn.commit()

        migrate_players(conn, hero="xavieeee2")

        count = conn.execute("SELECT COUNT(*) FROM players WHERE name='SameGuy'").fetchone()[0]
        assert count == 1
        conn.close()


# ─── Migration: hand_players population ───────────────────────


class TestMigrationHandPlayers:
    def test_hand_players_populated(self, temp_db_path):
        conn = sqlite3.connect(str(temp_db_path))
        _create_schema(conn)
        conn.execute("INSERT INTO tournaments (id, room, hero, source_file) VALUES (1, 'cp', 'xavieeee2', 'f.xml')")
        _insert_hand(conn, "GC1", 1, [
            {"name": "xavieeee2", "chips": 500, "dealer": "1", "win": "0"},
            {"name": "VillA", "chips": 400, "dealer": "0", "win": "100"},
            {"name": "VillB", "chips": 300, "dealer": "0", "win": "200"},
        ])
        conn.commit()

        migrate_players(conn, hero="xavieeee2")

        hp_rows = conn.execute("""
            SELECT p.name, hp.chips, hp.is_dealer, hp.win
            FROM hand_players hp JOIN players p ON hp.player_id = p.id
            ORDER BY p.name
        """).fetchall()
        assert len(hp_rows) == 2
        assert hp_rows[0] == ("VillA", 400.0, 0, 100.0)
        assert hp_rows[1] == ("VillB", 300.0, 0, 200.0)
        conn.close()

    def test_hand_players_win_with_commas(self, temp_db_path):
        """Win values like '1,020' should parse correctly."""
        conn = sqlite3.connect(str(temp_db_path))
        _create_schema(conn)
        conn.execute("INSERT INTO tournaments (id, room, hero, source_file) VALUES (1, 'cp', 'xavieeee2', 'f.xml')")
        _insert_hand(conn, "GC1", 1, [
            {"name": "xavieeee2", "chips": 500, "dealer": "1", "win": "0"},
            {"name": "BigWinner", "chips": 500, "dealer": "0", "win": "1,020"},
        ])
        conn.commit()

        migrate_players(conn, hero="xavieeee2")

        win = conn.execute("""
            SELECT hp.win FROM hand_players hp
            JOIN players p ON hp.player_id = p.id
            WHERE p.name = 'BigWinner'
        """).fetchone()[0]
        assert win == 1020.0
        conn.close()

    def test_dealer_flag_parsed(self, temp_db_path):
        conn = sqlite3.connect(str(temp_db_path))
        _create_schema(conn)
        conn.execute("INSERT INTO tournaments (id, room, hero, source_file) VALUES (1, 'cp', 'xavieeee2', 'f.xml')")
        _insert_hand(conn, "GC1", 1, [
            {"name": "xavieeee2", "chips": 500, "dealer": "0", "win": "0"},
            {"name": "DealerVill", "chips": 500, "dealer": "1", "win": "0"},
        ])
        conn.commit()

        migrate_players(conn, hero="xavieeee2")

        is_dealer = conn.execute("""
            SELECT hp.is_dealer FROM hand_players hp
            JOIN players p ON hp.player_id = p.id WHERE p.name='DealerVill'
        """).fetchone()[0]
        assert is_dealer == 1
        conn.close()


# ─── Migration: tipo preservation ─────────────────────────────


class TestMigrationTipoPreservation:
    def test_preserves_existing_tipo(self, temp_db_path):
        """If a player was already marked 'reg', migration preserves it."""
        conn = sqlite3.connect(str(temp_db_path))
        _create_schema(conn)
        # Pre-populate with old tipo
        conn.execute("INSERT INTO players (name, tipo) VALUES ('VillA', 'reg')")
        conn.execute("INSERT INTO tournaments (id, room, hero, source_file) VALUES (1, 'cp', 'xavieeee2', 'f.xml')")
        _insert_hand(conn, "GC1", 1, [
            {"name": "xavieeee2", "chips": 500, "dealer": "1", "win": "0"},
            {"name": "VillA", "chips": 500, "dealer": "0", "win": "0"},
        ])
        conn.commit()

        migrate_players(conn, hero="xavieeee2")

        tipo = conn.execute("SELECT tipo FROM players WHERE name='VillA'").fetchone()[0]
        assert tipo == "reg"
        conn.close()

    def test_new_player_defaults_to_fish(self, temp_db_path):
        conn = sqlite3.connect(str(temp_db_path))
        _create_schema(conn)
        conn.execute("INSERT INTO tournaments (id, room, hero, source_file) VALUES (1, 'cp', 'xavieeee2', 'f.xml')")
        _insert_hand(conn, "GC1", 1, [
            {"name": "xavieeee2", "chips": 500, "dealer": "1", "win": "0"},
            {"name": "NewPlayer", "chips": 500, "dealer": "0", "win": "0"},
        ])
        conn.commit()

        migrate_players(conn, hero="xavieeee2")

        tipo = conn.execute("SELECT tipo FROM players WHERE name='NewPlayer'").fetchone()[0]
        assert tipo == "fish"
        conn.close()


# ─── Migration: idempotency ───────────────────────────────────


class TestMigrationIdempotency:
    def test_running_twice_same_result(self, temp_db_path):
        conn = sqlite3.connect(str(temp_db_path))
        _create_schema(conn)
        conn.execute("INSERT INTO tournaments (id, room, hero, source_file) VALUES (1, 'cp', 'xavieeee2', 'f.xml')")
        _insert_hand(conn, "GC1", 1, [
            {"name": "xavieeee2", "chips": 500, "dealer": "1", "win": "0"},
            {"name": "VillA", "chips": 400, "dealer": "0", "win": "50"},
        ])
        conn.commit()

        migrate_players(conn, hero="xavieeee2")
        p1 = conn.execute("SELECT COUNT(*) FROM players").fetchone()[0]
        hp1 = conn.execute("SELECT COUNT(*) FROM hand_players").fetchone()[0]

        migrate_players(conn, hero="xavieeee2")
        p2 = conn.execute("SELECT COUNT(*) FROM players").fetchone()[0]
        hp2 = conn.execute("SELECT COUNT(*) FROM hand_players").fetchone()[0]

        assert p1 == p2
        assert hp1 == hp2
        conn.close()


# ─── Migration: dry run ───────────────────────────────────────


class TestMigrationDryRun:
    def test_dry_run_no_changes(self, temp_db_path):
        conn = sqlite3.connect(str(temp_db_path))
        _create_schema(conn)
        # Pre-insert garbage
        conn.execute("INSERT INTO players (name, tipo) VALUES ('Garbage', 'fish')")
        conn.execute("INSERT INTO tournaments (id, room, hero, source_file) VALUES (1, 'cp', 'xavieeee2', 'f.xml')")
        _insert_hand(conn, "GC1", 1, [
            {"name": "xavieeee2", "chips": 500, "dealer": "1", "win": "0"},
            {"name": "RealVill", "chips": 500, "dealer": "0", "win": "0"},
        ])
        conn.commit()

        migrate_players(conn, hero="xavieeee2", dry_run=True)

        # Should still have old garbage
        names = [r[0] for r in conn.execute("SELECT name FROM players").fetchall()]
        assert "Garbage" in names
        assert "RealVill" not in names
        conn.close()


# ─── Migration: edge cases ────────────────────────────────────


class TestMigrationEdgeCases:
    def test_empty_hands_table(self, temp_db_path):
        conn = sqlite3.connect(str(temp_db_path))
        _create_schema(conn)
        conn.commit()

        migrate_players(conn, hero="xavieeee2")

        assert conn.execute("SELECT COUNT(*) FROM players").fetchone()[0] == 0
        assert conn.execute("SELECT COUNT(*) FROM hand_players").fetchone()[0] == 0
        conn.close()

    def test_corrupt_players_json_skipped(self, temp_db_path):
        conn = sqlite3.connect(str(temp_db_path))
        _create_schema(conn)
        conn.execute("INSERT INTO tournaments (id, room, hero, source_file) VALUES (1, 'cp', 'xavieeee2', 'f.xml')")
        conn.execute(
            "INSERT INTO hands (gamecode, tournament_id, room, hero, players_json) VALUES ('GC1', 1, 'cp', 'xavieeee2', 'NOT_JSON{')"
        )
        # Also insert a valid hand
        _insert_hand(conn, "GC2", 1, [
            {"name": "xavieeee2", "chips": 500, "dealer": "1", "win": "0"},
            {"name": "GoodVill", "chips": 500, "dealer": "0", "win": "0"},
        ])
        conn.commit()

        migrate_players(conn, hero="xavieeee2")

        names = [r[0] for r in conn.execute("SELECT name FROM players").fetchall()]
        assert "GoodVill" in names
        assert conn.execute("SELECT COUNT(*) FROM players").fetchone()[0] == 1
        conn.close()

    def test_ids_reset_after_migration(self, temp_db_path):
        """Player IDs should start from 1 after migration."""
        conn = sqlite3.connect(str(temp_db_path))
        _create_schema(conn)
        # Pre-insert with high IDs (simulating previous state)
        conn.execute("INSERT INTO players (name, tipo) VALUES ('Old1', 'fish')")
        conn.execute("INSERT INTO players (name, tipo) VALUES ('Old2', 'fish')")
        conn.execute("DELETE FROM players")
        # sqlite_sequence still has high value
        conn.execute("INSERT INTO tournaments (id, room, hero, source_file) VALUES (1, 'cp', 'xavieeee2', 'f.xml')")
        _insert_hand(conn, "GC1", 1, [
            {"name": "xavieeee2", "chips": 500, "dealer": "1", "win": "0"},
            {"name": "Fresh", "chips": 500, "dealer": "0", "win": "0"},
        ])
        conn.commit()

        migrate_players(conn, hero="xavieeee2")

        min_id = conn.execute("SELECT MIN(id) FROM players").fetchone()[0]
        assert min_id == 1
        conn.close()

    def test_clears_aliases_table(self, temp_db_path):
        conn = sqlite3.connect(str(temp_db_path))
        _create_schema(conn)
        conn.execute("INSERT INTO tournaments (id, room, hero, source_file) VALUES (1, 'cp', 'xavieeee2', 'f.xml')")
        _insert_hand(conn, "GC1", 1, [
            {"name": "xavieeee2", "chips": 500, "dealer": "1", "win": "0"},
            {"name": "VillA", "chips": 500, "dealer": "0", "win": "0"},
        ])
        conn.commit()

        migrate_players(conn, hero="xavieeee2")

        # Manually add an alias
        pid = conn.execute("SELECT id FROM players WHERE name='VillA'").fetchone()[0]
        conn.execute("INSERT INTO player_aliases (alias, player_id, source) VALUES ('garbled', ?, 'test')", (pid,))
        conn.commit()
        assert conn.execute("SELECT COUNT(*) FROM player_aliases").fetchone()[0] == 1

        # Re-run migration — aliases should be cleared
        migrate_players(conn, hero="xavieeee2")
        assert conn.execute("SELECT COUNT(*) FROM player_aliases").fetchone()[0] == 0
        conn.close()
