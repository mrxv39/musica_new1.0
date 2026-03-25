import sqlite3
import tempfile
import os
import pytest
# [test_id:PLAYER_STATS]
from modules.stats.player_stats import (
    PlayerAccum,
    _process_hand,
    ensure_player_stats_table,
    refresh_player_stats,
    format_player_stats,
    get_player_stats,
)
from modules.importers.championpoker_xml_importer import ensure_schema


def _make_actions(*specs):
    """Build action tuples from compact specs.

    Each spec: (round_no, player, type_name, sum_chips)
    action_no is auto-assigned.
    """
    return [(r, i + 1, p, t, s) for i, (r, p, t, s) in enumerate(specs)]


class TestProcessHand:
    """Unit tests for _process_hand logic (keyed by (player, table_size))."""

    def test_vpip_and_pfr_3h(self):
        """3-handed: BTN raises, SB folds, BB calls."""
        actions = _make_actions(
            (0, "SB", "POST_SB", 10),
            (0, "BB", "POST_BB", 20),
            (1, "BTN", "RAISE", 60),
            (1, "SB", "FOLD", 0),
            (1, "BB", "CALL", 40),
        )
        accums = {}
        _process_hand(actions, accums)

        assert ("BTN", 3) in accums
        assert accums[("BTN", 3)].vpip_hands == 1
        assert accums[("BTN", 3)].pfr_hands == 1
        assert accums[("BB", 3)].vpip_hands == 1
        assert accums[("BB", 3)].pfr_hands == 0
        assert accums[("SB", 3)].vpip_hands == 0

    def test_hu_separate_from_3h(self):
        """HU hand goes into table_size=2 bucket."""
        actions = _make_actions(
            (0, "SB", "POST_SB", 10),
            (0, "BB", "POST_BB", 20),
            (1, "SB", "RAISE", 60),
            (1, "BB", "FOLD", 0),
        )
        accums = {}
        _process_hand(actions, accums)

        assert ("SB", 2) in accums
        assert ("SB", 3) not in accums
        assert accums[("SB", 2)].total_hands == 1
        assert accums[("SB", 2)].pfr_hands == 1

    def test_mixed_3h_and_hu(self):
        """Same player in both 3H and HU hands gets separate stats."""
        accums = {}

        # 3H hand
        _process_hand(_make_actions(
            (0, "A", "POST_SB", 10),
            (0, "B", "POST_BB", 20),
            (1, "C", "RAISE", 60),
            (1, "A", "FOLD", 0),
            (1, "B", "CALL", 40),
        ), accums)

        # HU hand with same player A
        _process_hand(_make_actions(
            (0, "A", "POST_SB", 10),
            (0, "B", "POST_BB", 20),
            (1, "A", "RAISE", 60),
            (1, "B", "FOLD", 0),
        ), accums)

        assert accums[("A", 3)].total_hands == 1
        assert accums[("A", 3)].vpip_hands == 0
        assert accums[("A", 2)].total_hands == 1
        assert accums[("A", 2)].vpip_hands == 1
        assert accums[("A", 2)].pfr_hands == 1

    def test_limp(self):
        actions = _make_actions(
            (0, "SB", "POST_SB", 10),
            (0, "BB", "POST_BB", 20),
            (1, "BTN", "FOLD", 0),
            (1, "SB", "CALL", 10),
            (1, "BB", "CHECK", 0),
        )
        accums = {}
        _process_hand(actions, accums)

        assert accums[("SB", 3)].limp_hands == 1
        assert accums[("BB", 3)].limp_hands == 0

    def test_3bet_detection(self):
        actions = _make_actions(
            (0, "SB", "POST_SB", 10),
            (0, "BB", "POST_BB", 20),
            (1, "BTN", "RAISE", 60),
            (1, "SB", "RAISE", 180),
            (1, "BB", "FOLD", 0),
            (1, "BTN", "FOLD", 0),
        )
        accums = {}
        _process_hand(actions, accums)

        assert accums[("SB", 3)].threeb_hands == 1
        assert accums[("BTN", 3)].fold_to_3b == 1

    def test_4bet(self):
        actions = _make_actions(
            (0, "SB", "POST_SB", 10),
            (0, "BB", "POST_BB", 20),
            (1, "BTN", "RAISE", 60),
            (1, "SB", "RAISE", 180),
            (1, "BB", "FOLD", 0),
            (1, "BTN", "ALL_IN", 500),
            (1, "SB", "FOLD", 0),
        )
        accums = {}
        _process_hand(actions, accums)

        assert accums[("BTN", 3)].fourb_hands == 1
        assert accums[("BTN", 3)].fold_to_3b == 0

    def test_af_postflop(self):
        actions = _make_actions(
            (0, "A", "POST_SB", 10),
            (0, "B", "POST_BB", 20),
            (1, "A", "CALL", 10),
            (1, "B", "CHECK", 0),
            (2, "A", "BET", 30),
            (2, "B", "CALL", 30),
            (3, "A", "BET", 60),
            (3, "B", "RAISE", 180),
            (3, "A", "CALL", 120),
        )
        accums = {}
        _process_hand(actions, accums)

        assert accums[("A", 2)].af_bets_raises == 2
        assert accums[("A", 2)].af_calls == 1
        assert accums[("B", 2)].af_bets_raises == 1
        assert accums[("B", 2)].af_calls == 1

    def test_wtsd(self):
        actions = _make_actions(
            (0, "A", "POST_SB", 10),
            (0, "B", "POST_BB", 20),
            (1, "A", "CALL", 10),
            (1, "B", "CHECK", 0),
            (2, "A", "CHECK", 0),
            (2, "B", "CHECK", 0),
            (4, "A", "CHECK", 0),
            (4, "B", "BET", 20),
            (4, "A", "CALL", 20),
        )
        accums = {}
        _process_hand(actions, accums)

        assert accums[("A", 2)].wtsd_hands == 1
        assert accums[("B", 2)].wtsd_hands == 1

    def test_skip_single_player_hand(self):
        """Hands with only 1 player (walkover) are skipped."""
        actions = _make_actions(
            (0, "A", "POST_SB", 10),
        )
        accums = {}
        _process_hand(actions, accums)
        assert len(accums) == 0


class TestRefreshAndQuery:
    def test_refresh_and_get_by_table_size(self):
        with tempfile.TemporaryDirectory() as td:
            db_path = os.path.join(td, "test.db")
            conn = sqlite3.connect(db_path)
            ensure_schema(conn)
            ensure_player_stats_table(conn)

            # Insert a 3-handed hand
            conn.execute("""
                INSERT INTO hands(room, hero, source_file, gamecode, sb, bb)
                VALUES ('test', 'hero', 'f.xml', 'G1', 10, 20)
            """)
            hand_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
            conn.executemany("""
                INSERT INTO actions_real(hand_id, gamecode, round_no, action_no,
                    player, type_id, type_name, sum_chips, sum_bb)
                VALUES (?, 'G1', ?, ?, ?, 0, ?, ?, ?)
            """, [
                (hand_id, 0, 1, "SB", "POST_SB", 10, 0.5),
                (hand_id, 0, 2, "BB", "POST_BB", 20, 1.0),
                (hand_id, 1, 3, "hero", "RAISE", 60, 3.0),
                (hand_id, 1, 4, "SB", "FOLD", 0, 0),
                (hand_id, 1, 5, "BB", "CALL", 40, 2.0),
            ])
            conn.commit()
            conn.close()

            result = refresh_player_stats(db_path, verbose=False)
            assert result["ok"]

            # Query by table_size=3
            hero_3h = get_player_stats(db_path, "hero", table_size=3)
            assert hero_3h is not None
            assert hero_3h["total_hands"] == 1
            assert hero_3h["pfr_hands"] == 1

            # Query by table_size=2 should be None
            hero_hu = get_player_stats(db_path, "hero", table_size=2)
            assert hero_hu is None

            # Combined (no table_size filter)
            hero_all = get_player_stats(db_path, "hero")
            assert hero_all["total_hands"] == 1


class TestFormatPlayerStats:
    def test_format_with_table_size(self):
        stats = {
            "player": "Test",
            "table_size": 3,
            "total_hands": 100,
            "vpip_hands": 45,
            "pfr_hands": 30,
            "threeb_hands": 5,
            "threeb_opps": 20,
            "fold_to_3b": 8,
            "fold_to_3b_opps": 15,
            "fourb_hands": 2,
            "fourb_opps": 8,
            "limp_hands": 10,
            "af_bets_raises": 60,
            "af_calls": 30,
            "wtsd_hands": 15,
            "wtsd_opps": 50,
        }
        output = format_player_stats(stats)
        assert "[3H]" in output
        assert "45.0%" in output  # VPIP

    def test_format_hu(self):
        stats = {
            "player": "Test",
            "table_size": 2,
            "total_hands": 50,
            "vpip_hands": 40,
            "pfr_hands": 35,
            "threeb_hands": 10,
            "threeb_opps": 20,
            "fold_to_3b": 3,
            "fold_to_3b_opps": 10,
            "fourb_hands": 1,
            "fourb_opps": 3,
            "limp_hands": 2,
            "af_bets_raises": 30,
            "af_calls": 15,
            "wtsd_hands": 10,
            "wtsd_opps": 25,
        }
        output = format_player_stats(stats)
        assert "[HU]" in output
        assert "80.0%" in output  # VPIP 40/50
