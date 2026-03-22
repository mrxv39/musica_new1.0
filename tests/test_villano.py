"""
Tests for modules.ocr.villano — player resolution pipeline.

Covers:
  - resolve_name pipeline (exact, alias, XML, fallback)
  - classify_villano integration (p2/p3, gamecode passthrough)
  - OCR noise filtering (short names)
  - XML-based auto-alias registration
  - Multi-villain disambiguation
  - Edge cases (corrupt JSON, missing tables, duplicate calls)
"""

import json
import sqlite3

from modules.ocr.villano import (
    classify_villano,
    resolve_name,
    _resolve_via_xml,
    _ensure_player,
    _get_xml_names_for_tournament,
    ensure_players_tables,
    MIN_NAME_LENGTH,
)


# ─── Helpers ───────────────────────────────────────────────────


def _setup_full_schema(conn):
    """Create players, player_aliases, hands, and tournaments tables."""
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS players (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            tipo TEXT NOT NULL DEFAULT 'fish',
            notes TEXT NOT NULL DEFAULT '',
            created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS player_aliases (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            alias TEXT UNIQUE NOT NULL,
            player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
            source TEXT NOT NULL DEFAULT 'manual',
            created_at TEXT DEFAULT (datetime('now'))
        );
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
    """)


def _insert_hand(conn, gamecode, tournament_id, villain_names):
    """Insert a hand with hero + given villain names."""
    players = [{"name": "xavieeee2", "chips": 500, "dealer": "1", "win": "0"}]
    for vn in villain_names:
        players.append({"name": vn, "chips": 500, "dealer": "0", "win": "0"})
    pj = json.dumps({"players": players})
    conn.execute(
        "INSERT INTO hands (gamecode, tournament_id, room, hero, players_json) VALUES (?, ?, 'cp', 'xavieeee2', ?)",
        (gamecode, tournament_id, pj),
    )
    conn.commit()


def _setup_tournament_with_player(conn, villain, tipo="fish"):
    """Create tournament + hand + player in one step."""
    conn.execute("INSERT OR IGNORE INTO tournaments (id, room, hero, source_file) VALUES (1, 'cp', 'xavieeee2', 'f1.xml')")
    conn.execute(f"INSERT OR IGNORE INTO players (name, tipo) VALUES (?, ?)", (villain, tipo))
    conn.commit()


# ─── resolve_name: step 1 — exact match ───────────────────────


class TestResolveNameExactMatch:
    def test_exact_match_returns_name_and_tipo(self, temp_db_path):
        conn = sqlite3.connect(str(temp_db_path))
        _setup_full_schema(conn)
        conn.execute("INSERT INTO players (name, tipo) VALUES ('kenny1986', 'reg')")
        conn.commit()

        name, tipo = resolve_name(conn, "kenny1986")
        assert name == "kenny1986"
        assert tipo == "reg"

    def test_exact_match_is_case_sensitive(self, temp_db_path):
        """Exact match is case-sensitive; 'Kenny1986' != 'kenny1986'."""
        conn = sqlite3.connect(str(temp_db_path))
        _setup_full_schema(conn)
        conn.execute("INSERT INTO players (name, tipo) VALUES ('kenny1986', 'reg')")
        conn.commit()

        # Different casing — should NOT match exact, falls through to insert
        name, tipo = resolve_name(conn, "Kenny1986")
        assert name == "Kenny1986"
        assert tipo == "fish"


# ─── resolve_name: step 2 — alias match ───────────────────────


class TestResolveNameAliasMatch:
    def test_alias_resolves_to_canonical(self, temp_db_path):
        conn = sqlite3.connect(str(temp_db_path))
        _setup_full_schema(conn)
        conn.execute("INSERT INTO players (name, tipo) VALUES ('Gavron3', 'reg')")
        pid = conn.execute("SELECT id FROM players WHERE name='Gavron3'").fetchone()[0]
        conn.execute("INSERT INTO player_aliases (alias, player_id, source) VALUES ('Gavrons1a', ?, 'manual')", (pid,))
        conn.commit()

        name, tipo = resolve_name(conn, "Gavrons1a")
        assert name == "Gavron3"
        assert tipo == "reg"

    def test_alias_not_found_continues_pipeline(self, temp_db_path):
        conn = sqlite3.connect(str(temp_db_path))
        _setup_full_schema(conn)
        conn.execute("INSERT INTO players (name, tipo) VALUES ('Gavron3', 'reg')")
        conn.commit()

        # No alias registered — should fall through to insert as new
        name, tipo = resolve_name(conn, "Gavrons1a")
        assert name == "Gavrons1a"
        assert tipo == "fish"


# ─── resolve_name: step 0 — noise filter ──────────────────────


class TestResolveNameNoiseFilter:
    def test_short_name_returns_empty(self, temp_db_path):
        conn = sqlite3.connect(str(temp_db_path))
        _setup_full_schema(conn)

        name, tipo = resolve_name(conn, "UC")
        assert name == ""
        assert tipo == ""

    def test_exactly_min_length_is_accepted(self, temp_db_path):
        conn = sqlite3.connect(str(temp_db_path))
        _setup_full_schema(conn)

        name, tipo = resolve_name(conn, "abc")
        assert name == "abc"
        assert tipo == "fish"

    def test_empty_string_returns_empty(self, temp_db_path):
        conn = sqlite3.connect(str(temp_db_path))
        _setup_full_schema(conn)

        name, tipo = resolve_name(conn, "")
        assert name == ""
        assert tipo == ""

    def test_noise_not_inserted_to_db(self, temp_db_path):
        conn = sqlite3.connect(str(temp_db_path))
        _setup_full_schema(conn)

        resolve_name(conn, "ee")
        resolve_name(conn, "UF")
        resolve_name(conn, "ia")
        conn.commit()

        count = conn.execute("SELECT COUNT(*) FROM players").fetchone()[0]
        assert count == 0


# ─── resolve_name: step 3 — XML resolution ────────────────────


class TestResolveNameXmlResolution:
    def test_hu_auto_alias_on_gamecode_match(self, temp_db_path):
        """HU hand (1 villain in XML) → OCR garbled name auto-resolves."""
        conn = sqlite3.connect(str(temp_db_path))
        _setup_full_schema(conn)
        _setup_tournament_with_player(conn, "LetsRollTheDice1")
        _insert_hand(conn, "GC100", 1, ["LetsRollTheDice1"])

        name, tipo = resolve_name(conn, "sRouTheDiceli", gamecode="GC100")
        assert name == "LetsRollTheDice1"
        assert tipo == "fish"

        # Alias was auto-registered
        row = conn.execute("SELECT source FROM player_aliases WHERE alias='sRouTheDiceli'").fetchone()
        assert row is not None
        assert row[0] == "xml_gamecode"

    def test_xml_case_insensitive_direct_match(self, temp_db_path):
        """OCR reads same name with different casing → resolves via XML."""
        conn = sqlite3.connect(str(temp_db_path))
        _setup_full_schema(conn)
        _setup_tournament_with_player(conn, "oksischoo")
        _insert_hand(conn, "GC200", 1, ["oksischoo"])

        name, tipo = resolve_name(conn, "OKSISCHOO", gamecode="GC200")
        assert name == "oksischoo"

    def test_no_gamecode_skips_xml(self, temp_db_path):
        """Without gamecode, XML resolution is skipped entirely."""
        conn = sqlite3.connect(str(temp_db_path))
        _setup_full_schema(conn)
        _setup_tournament_with_player(conn, "Azenor")
        _insert_hand(conn, "GC300", 1, ["Azenor"])

        name, tipo = resolve_name(conn, "Azenor4", gamecode="")
        assert name == "Azenor4"  # inserted as new player
        assert tipo == "fish"

    def test_gamecode_not_in_db_skips_xml(self, temp_db_path):
        """Gamecode that doesn't exist in hands → skip XML."""
        conn = sqlite3.connect(str(temp_db_path))
        _setup_full_schema(conn)

        name, tipo = resolve_name(conn, "SomePlayer", gamecode="NONEXISTENT")
        assert name == "SomePlayer"
        assert tipo == "fish"

    def test_xml_with_no_villains_skips(self, temp_db_path):
        """Hand with only hero in players_json → no resolution."""
        conn = sqlite3.connect(str(temp_db_path))
        _setup_full_schema(conn)
        conn.execute("INSERT INTO tournaments (id, room, hero, source_file) VALUES (1, 'cp', 'xavieeee2', 'f.xml')")
        # Hand with only hero
        pj = json.dumps({"players": [{"name": "xavieeee2", "chips": 500}]})
        conn.execute("INSERT INTO hands (gamecode, tournament_id, room, hero, players_json) VALUES ('GC400', 1, 'cp', 'xavieeee2', ?)", (pj,))
        conn.commit()

        name, tipo = resolve_name(conn, "RandomOCR", gamecode="GC400")
        assert name == "RandomOCR"

    def test_xml_corrupt_json_doesnt_crash(self, temp_db_path):
        """Corrupt players_json in hands table → graceful fallback."""
        conn = sqlite3.connect(str(temp_db_path))
        _setup_full_schema(conn)
        conn.execute("INSERT INTO tournaments (id, room, hero, source_file) VALUES (1, 'cp', 'xavieeee2', 'f.xml')")
        conn.execute("INSERT INTO hands (gamecode, tournament_id, room, hero, players_json) VALUES ('GC500', 1, 'cp', 'xavieeee2', 'NOT_JSON{')")
        conn.commit()

        name, tipo = resolve_name(conn, "SomeOCR", gamecode="GC500")
        assert name == "SomeOCR"
        assert tipo == "fish"


# ─── resolve_name: step 3 — multi-villain XML ─────────────────


class TestResolveNameMultiVillain:
    def test_two_villains_no_auto_alias(self, temp_db_path):
        """With 2 villains in a hand, we can't auto-alias (ambiguous)."""
        conn = sqlite3.connect(str(temp_db_path))
        _setup_full_schema(conn)
        conn.execute("INSERT INTO tournaments (id, room, hero, source_file) VALUES (1, 'cp', 'xavieeee2', 'f.xml')")
        conn.execute("INSERT INTO players (name, tipo) VALUES ('VillainA', 'fish')")
        conn.execute("INSERT INTO players (name, tipo) VALUES ('VillainB', 'reg')")
        _insert_hand(conn, "GC600", 1, ["VillainA", "VillainB"])

        # OCR reads garbled name — 2 villains, can't determine which one
        name, tipo = resolve_name(conn, "VillnA_garbled", gamecode="GC600")
        assert name == "VillnA_garbled"  # falls through to insert as new
        assert tipo == "fish"

    def test_two_villains_case_insensitive_match(self, temp_db_path):
        """With 2 villains, case-insensitive match in tournament context works."""
        conn = sqlite3.connect(str(temp_db_path))
        _setup_full_schema(conn)
        conn.execute("INSERT INTO tournaments (id, room, hero, source_file) VALUES (1, 'cp', 'xavieeee2', 'f.xml')")
        conn.execute("INSERT INTO players (name, tipo) VALUES ('VillainA', 'fish')")
        conn.execute("INSERT INTO players (name, tipo) VALUES ('VillainB', 'reg')")
        _insert_hand(conn, "GC700", 1, ["VillainA", "VillainB"])

        # OCR reads exact name with different case → should resolve via tournament scan
        name, tipo = resolve_name(conn, "villaina", gamecode="GC700")
        assert name == "VillainA"


# ─── resolve_name: step 4 — fallback insert ───────────────────


class TestResolveNameFallback:
    def test_unknown_name_inserted_as_fish(self, temp_db_path):
        conn = sqlite3.connect(str(temp_db_path))
        _setup_full_schema(conn)

        name, tipo = resolve_name(conn, "BrandNewPlayer")
        assert name == "BrandNewPlayer"
        assert tipo == "fish"

        row = conn.execute("SELECT tipo FROM players WHERE name='BrandNewPlayer'").fetchone()
        assert row[0] == "fish"

    def test_duplicate_insert_is_idempotent(self, temp_db_path):
        conn = sqlite3.connect(str(temp_db_path))
        _setup_full_schema(conn)

        resolve_name(conn, "PlayerX")
        resolve_name(conn, "PlayerX")
        conn.commit()

        count = conn.execute("SELECT COUNT(*) FROM players WHERE name='PlayerX'").fetchone()[0]
        assert count == 1


# ─── classify_villano integration ─────────────────────────────


class TestClassifyVillano:
    def test_both_seats_resolved(self, temp_db_path):
        out = classify_villano(image_path="fake.bmp", p2_name="Alpha", p3_name="Beta")
        assert out["ok"] is True
        assert out["p2"]["name"] == "Alpha"
        assert out["p3"]["name"] == "Beta"

    def test_single_seat_ok(self, temp_db_path):
        out = classify_villano(image_path="fake.bmp", p2_name="Solo", p3_name="")
        assert out["ok"] is True
        assert out["p2"]["name"] == "Solo"
        assert out["p3"]["name"] == ""

    def test_no_names_returns_not_ok(self, temp_db_path):
        out = classify_villano(image_path="fake.bmp", p2_name="", p3_name="")
        assert out["ok"] is False
        assert "no_valid_names" in out["errors"]

    def test_both_short_names_returns_not_ok(self, temp_db_path):
        out = classify_villano(image_path="fake.bmp", p2_name="UC", p3_name="ee")
        assert out["ok"] is False
        assert out["p2"]["name"] == ""
        assert out["p3"]["name"] == ""

    def test_gamecode_passed_to_xml_resolution(self, temp_db_path):
        """Gamecode flows through classify_villano → resolve_name → XML."""
        conn = sqlite3.connect(str(temp_db_path))
        _setup_full_schema(conn)
        _setup_tournament_with_player(conn, "FrizYT", "reg")
        _insert_hand(conn, "GC_FIZZY", 1, ["FrizYT"])
        conn.close()

        out = classify_villano(image_path="fake.bmp", p2_name="erizyT", p3_name="", gamecode="GC_FIZZY")
        assert out["p2"]["name"] == "FrizYT"
        assert out["p2"]["tipo"] == "reg"
        assert out["p2"]["ocr_alias"] == "erizyT"

    def test_ocr_alias_field_absent_when_name_matches(self, temp_db_path):
        conn = sqlite3.connect(str(temp_db_path))
        _setup_full_schema(conn)
        conn.execute("INSERT INTO players (name, tipo) VALUES ('ExactName', 'fish')")
        conn.commit()
        conn.close()

        out = classify_villano(image_path="fake.bmp", p2_name="ExactName", p3_name="")
        assert out["p2"]["name"] == "ExactName"
        assert "ocr_alias" not in out["p2"]

    def test_whitespace_stripped(self, temp_db_path):
        out = classify_villano(image_path="fake.bmp", p2_name="  Alpha  ", p3_name=" Beta ")
        assert out["p2"]["name"] == "Alpha"
        assert out["p3"]["name"] == "Beta"

    def test_none_names_handled(self, temp_db_path):
        out = classify_villano(image_path="fake.bmp", p2_name=None, p3_name=None)
        assert out["ok"] is False


# ─── alias persistence ────────────────────────────────────────


class TestAliasPersistence:
    def test_auto_alias_persists_across_calls(self, temp_db_path):
        """Alias registered in tick 1 resolves in tick 2 even without gamecode."""
        conn = sqlite3.connect(str(temp_db_path))
        _setup_full_schema(conn)
        _setup_tournament_with_player(conn, "Nemesis1973", "reg")
        _insert_hand(conn, "GC_NEM", 1, ["Nemesis1973"])
        conn.close()

        # Tick 1: auto-alias via XML
        out1 = classify_villano(image_path="fake.bmp", p2_name="emesis33", gamecode="GC_NEM")
        assert out1["p2"]["name"] == "Nemesis1973"

        # Tick 2: resolve via alias (no gamecode needed)
        out2 = classify_villano(image_path="fake.bmp", p2_name="emesis33", gamecode="")
        assert out2["p2"]["name"] == "Nemesis1973"
        assert out2["p2"]["tipo"] == "reg"

    def test_multiple_aliases_for_same_player(self, temp_db_path):
        """Multiple OCR variants of the same player all resolve correctly."""
        conn = sqlite3.connect(str(temp_db_path))
        _setup_full_schema(conn)
        _setup_tournament_with_player(conn, "RufusBalotelli")
        _insert_hand(conn, "GC_R1", 1, ["RufusBalotelli"])
        _insert_hand(conn, "GC_R2", 1, ["RufusBalotelli"])
        conn.close()

        # Register first alias
        out1 = classify_villano(image_path="fake.bmp", p2_name="uTusBaloteul", gamecode="GC_R1")
        assert out1["p2"]["name"] == "RufusBalotelli"

        # Register second alias
        out2 = classify_villano(image_path="fake.bmp", p2_name="ufusBaloteul", gamecode="GC_R2")
        assert out2["p2"]["name"] == "RufusBalotelli"

        # Both aliases now work without gamecode
        out3 = classify_villano(image_path="fake.bmp", p2_name="uTusBaloteul", gamecode="")
        assert out3["p2"]["name"] == "RufusBalotelli"

        out4 = classify_villano(image_path="fake.bmp", p2_name="ufusBaloteul", gamecode="")
        assert out4["p2"]["name"] == "RufusBalotelli"

        # Verify DB has 2 aliases
        conn = sqlite3.connect(str(temp_db_path))
        count = conn.execute(
            "SELECT COUNT(*) FROM player_aliases WHERE player_id=(SELECT id FROM players WHERE name='RufusBalotelli')"
        ).fetchone()[0]
        assert count == 2
        conn.close()


# ─── _ensure_player ───────────────────────────────────────────


class TestEnsurePlayer:
    def test_creates_new_player(self, temp_db_path):
        conn = sqlite3.connect(str(temp_db_path))
        _setup_full_schema(conn)

        pid = _ensure_player(conn, "NewGuy")
        assert pid > 0

        row = conn.execute("SELECT name, tipo FROM players WHERE id=?", (pid,)).fetchone()
        assert row == ("NewGuy", "fish")

    def test_returns_existing_player(self, temp_db_path):
        conn = sqlite3.connect(str(temp_db_path))
        _setup_full_schema(conn)
        conn.execute("INSERT INTO players (name, tipo) VALUES ('ExistingGuy', 'reg')")
        conn.commit()

        pid = _ensure_player(conn, "ExistingGuy")
        count = conn.execute("SELECT COUNT(*) FROM players WHERE name='ExistingGuy'").fetchone()[0]
        assert count == 1
        assert pid > 0


# ─── _get_xml_names_for_tournament ─────────────────────────────


class TestGetXmlNamesForTournament:
    def test_returns_villain_names_excluding_hero(self, temp_db_path):
        conn = sqlite3.connect(str(temp_db_path))
        _setup_full_schema(conn)
        conn.execute("INSERT INTO tournaments (id, room, hero, source_file) VALUES (1, 'cp', 'xavieeee2', 'f.xml')")
        _insert_hand(conn, "GC1", 1, ["VillA", "VillB"])
        _insert_hand(conn, "GC2", 1, ["VillA", "VillC"])

        names = _get_xml_names_for_tournament(conn, 1)
        assert set(names) == {"VillA", "VillB", "VillC"}

    def test_empty_tournament_returns_empty(self, temp_db_path):
        conn = sqlite3.connect(str(temp_db_path))
        _setup_full_schema(conn)
        conn.execute("INSERT INTO tournaments (id, room, hero, source_file) VALUES (1, 'cp', 'xavieeee2', 'f.xml')")
        conn.commit()

        names = _get_xml_names_for_tournament(conn, 1)
        assert names == []

    def test_nonexistent_tournament_returns_empty(self, temp_db_path):
        conn = sqlite3.connect(str(temp_db_path))
        _setup_full_schema(conn)

        names = _get_xml_names_for_tournament(conn, 999)
        assert names == []


# ─── ensure_players_tables ─────────────────────────────────────


class TestEnsurePlayersTables:
    def test_creates_both_tables(self, temp_db_path):
        conn = sqlite3.connect(str(temp_db_path))
        ensure_players_tables(conn)

        tables = {r[0] for r in conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('players', 'player_aliases')"
        ).fetchall()}
        assert tables == {"players", "player_aliases"}

    def test_idempotent(self, temp_db_path):
        conn = sqlite3.connect(str(temp_db_path))
        ensure_players_tables(conn)
        ensure_players_tables(conn)  # second call should not fail

        count = conn.execute("SELECT COUNT(*) FROM players").fetchone()[0]
        assert count == 0
