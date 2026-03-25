"""Tests for compute_table_state: must use bets to detect eliminated players."""

from modules.ocr.table_state import compute_table_state


def test_player_with_name_stack0_bet0_is_eliminated():
    """p2 has name visible but stack=0, bet=0 → eliminated."""
    result = compute_table_state(
        {"p2_name": "UC", "p3_name": "Villain"},
        {"p1": 10, "p2": 0, "p3": 5},
        {"p1": 1, "p2": 0, "p3": 1},
    )
    assert result["is_hu"] is True
    assert result["players"] == 2
    assert "p2" in result["eliminated_seats"]
    assert "p1" in result["active_seats"]
    assert "p3" in result["active_seats"]


def test_player_stack0_bet_positive_is_active():
    """p3 has stack=0 but bet>0 → all-in, still active."""
    result = compute_table_state(
        {"p2_name": "V1", "p3_name": "V2"},
        {"p1": 10, "p2": 8, "p3": 0},
        {"p1": 1, "p2": 0.5, "p3": 5},
    )
    assert result["players"] == 3
    assert "p3" in result["active_seats"]


def test_without_bets_name_visible_stack0_is_active():
    """Without bets info, can't distinguish eliminated from all-in."""
    result = compute_table_state(
        {"p2_name": "UC", "p3_name": "Villain"},
        {"p1": 10, "p2": 0, "p3": 5},
    )
    # Without bets, p2 has name + stack=0 → ambiguous, kept active
    assert result["players"] == 3


def test_3h_all_active():
    result = compute_table_state(
        {"p2_name": "V1", "p3_name": "V2"},
        {"p1": 15, "p2": 12, "p3": 10},
        {"p1": 0, "p2": 0.5, "p3": 1},
    )
    assert result["is_3h"] is True
    assert result["players"] == 3
