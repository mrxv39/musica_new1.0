"""Tests for _normalize_hu_positions: swap p3→p2 in HU when villain is in p3."""

from modules.workers.worker_strategy import _normalize_hu_positions


def _bets(p1, p2, p3):
    return {"p1_used": p1, "p2_used": p2, "p3_used": p3, "p1_raw": p1, "p2_raw": p2, "p3_raw": p3, "reason": ""}


def test_hu_villain_in_p3_swaps_to_p2():
    norm = _normalize_hu_positions(
        "", "SB", _bets(1, 0, 1), "UNKNOWN", "FISH",
        {"p1": 10, "p2": 0, "p3": 8}, {"is_hu": True},
    )
    assert norm["p2_pos"] == "SB"
    assert norm["p3_pos"] == ""
    assert norm["p2_tipo"] == "FISH"
    assert norm["p2_bet"] == 1
    assert norm["p3_bet"] == 0


def test_hu_villain_in_p3_tipo_inherits():
    """p3_tipo should inherit from the active villain (not be 'unknown')."""
    norm = _normalize_hu_positions(
        "", "SB", _bets(1, 0, 5), "UNKNOWN", "FISH",
        {"p1": 10, "p2": 0, "p3": 0}, {"is_hu": True},
    )
    assert norm["p2_tipo"] == "FISH"
    assert norm["p3_tipo"] == "FISH"  # inherits, not unknown


def test_hu_villain_already_in_p2_no_swap():
    norm = _normalize_hu_positions(
        "SB", "", _bets(1, 1, 0), "FISH", "UNKNOWN",
        {"p1": 10, "p2": 8, "p3": 0}, {"is_hu": True},
    )
    assert norm["p2_pos"] == "SB"
    assert norm["p2_tipo"] == "FISH"
    assert norm["p2_bet"] == 1


def test_3h_no_swap():
    """In 3-handed, no swap should happen."""
    norm = _normalize_hu_positions(
        "BTN", "SB", _bets(1, 0.5, 1), "FISH", "FISH",
        {"p1": 15, "p2": 12, "p3": 10}, {"is_hu": False},
    )
    assert norm["p2_pos"] == "BTN"
    assert norm["p3_pos"] == "SB"
    assert norm["p2_bet"] == 0.5
    assert norm["p3_bet"] == 1
