import sqlite3
import tempfile
import os
import pytest
# [test_id:PLAYER_STATS]
from modules.stats.player_stats import (
    PlayerAccum,
    _process_hand,
    compute_player_stats,
    save_player_stats,
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
    """Unit tests for _process_hand logic."""

    def test_vpip_and_pfr_basic(self):
        """BTN raises, SB folds, BB calls -> BTN has VPIP+PFR, BB has VPIP."""
        actions = _make_actions(
            (0, "SB", "POST_SB", 10),
            (0, "BB", "POST_BB", 20),
            (1, "BTN", "RAISE", 60),
            (1, "SB", "FOLD", 0),
            (1, "BB", "CALL", 40),
        )
        accums = {}
        _process_hand(actions, accums)

        assert accums["BTN"].total_hands == 1
        assert accums["BTN"].vpip_hands == 1
        assert accums["BTN"].pfr_hands == 1
        assert accums["BB"].vpip_hands == 1
        assert accums["BB"].pfr_hands == 0
        assert accums["SB"].vpip_hands == 0

    def test_limp(self):
        """SB calls (limp), BB checks -> SB has limp."""
        actions = _make_actions(
            (0, "SB", "POST_SB", 10),
            (0, "BB", "POST_BB", 20),
            (1, "BTN", "FOLD", 0),
            (1, "SB", "CALL", 10),
            (1, "BB", "CHECK", 0),
        )
        accums = {}
        _process_hand(actions, accums)

        assert accums["SB"].limp_hands == 1
        assert accums["SB"].vpip_hands == 1
        assert accums["BB"].limp_hands == 0

    def test_3bet_detection(self):
        """BTN raises, SB 3-bets -> SB has 3-bet, BTN has fold-to-3bet opp."""
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

        assert accums["SB"].threeb_hands == 1
        assert accums["SB"].threeb_opps == 1
        assert accums["BTN"].fold_to_3b_opps == 1
        assert accums["BTN"].fold_to_3b == 1

    def test_3bet_opportunity_for_multiple_players(self):
        """BTN raises -> SB folds (had 3bet opp) -> BB calls (had 3bet opp)."""
        actions = _make_actions(
            (0, "SB", "POST_SB", 10),
            (0, "BB", "POST_BB", 20),
            (1, "BTN", "RAISE", 60),
            (1, "SB", "FOLD", 0),
            (1, "BB", "CALL", 40),
        )
        accums = {}
        _process_hand(actions, accums)

        assert accums["SB"].threeb_opps == 1
        assert accums["BB"].threeb_opps == 1
        assert accums["SB"].threeb_hands == 0
        assert accums["BB"].threeb_hands == 0

    def test_4bet(self):
        """BTN raises, SB 3-bets, BTN 4-bets."""
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

        assert accums["BTN"].fourb_hands == 1
        assert accums["BTN"].fourb_opps == 1
        assert accums["BTN"].fold_to_3b == 0

    def test_aggression_factor_postflop(self):
        """Postflop: player bets and raises -> counted in AF."""
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

        assert accums["A"].af_bets_raises == 2  # 2 bets
        assert accums["A"].af_calls == 1  # 1 call postflop
        assert accums["B"].af_bets_raises == 1  # 1 raise
        assert accums["B"].af_calls == 1  # 1 call

    def test_wtsd(self):
        """Player who sees river without folding -> WTSD."""
        actions = _make_actions(
            (0, "A", "POST_SB", 10),
            (0, "B", "POST_BB", 20),
            (1, "A", "CALL", 10),
            (1, "B", "CHECK", 0),
            (2, "A", "CHECK", 0),
            (2, "B", "CHECK", 0),
            (3, "A", "CHECK", 0),
            (3, "B", "CHECK", 0),
            (4, "A", "CHECK", 0),
            (4, "B", "BET", 20),
            (4, "A", "CALL", 20),
        )
        accums = {}
        _process_hand(actions, accums)

        assert accums["A"].wtsd_opps == 1
        assert accums["A"].wtsd_hands == 1
        assert accums["B"].wtsd_hands == 1

    def test_wtsd_fold_on_river(self):
        """Player folds on river -> NOT WTSD."""
        actions = _make_actions(
            (0, "A", "POST_SB", 10),
            (0, "B", "POST_BB", 20),
            (1, "A", "CALL", 10),
            (1, "B", "CHECK", 0),
            (2, "A", "CHECK", 0),
            (2, "B", "CHECK", 0),
            (3, "A", "CHECK", 0),
            (3, "B", "CHECK", 0),
            (4, "A", "BET", 40),
            (4, "B", "FOLD", 0),
        )
        accums = {}
        _process_hand(actions, accums)

        assert accums["A"].wtsd_hands == 1
        assert accums["B"].wtsd_hands == 0

    def test_all_fold_preflop_no_postflop_stats(self):
        """Everyone folds preflop -> no postflop stats."""
        actions = _make_actions(
            (0, "SB", "POST_SB", 10),
            (0, "BB", "POST_BB", 20),
            (1, "BTN", "FOLD", 0),
            (1, "SB", "FOLD", 0),
        )
        accums = {}
        _process_hand(actions, accums)

        assert accums["BB"].wtsd_opps == 0
        assert accums["BB"].af_bets_raises == 0


class TestRefreshAndQuery:
    """Integration tests using a temp database."""

    def test_refresh_and_get(self):
        with tempfile.TemporaryDirectory() as td:
            db_path = os.path.join(td, "test.db")
            conn = sqlite3.connect(db_path)
            ensure_schema(conn)
            ensure_player_stats_table(conn)

            # Insert a simple hand
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
            assert result["players"] == 3

            hero = get_player_stats(db_path, "hero")
            assert hero is not None
            assert hero["total_hands"] == 1
            assert hero["vpip_hands"] == 1
            assert hero["pfr_hands"] == 1


class TestFormatPlayerStats:
    def test_format_basic(self):
        stats = {
            "player": "TestPlayer",
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
        assert "45.0%" in output  # VPIP
        assert "30.0%" in output  # PFR
        assert "25.0%" in output  # 3-bet (5/20)
        assert "2.0" in output    # AF (60/30)
