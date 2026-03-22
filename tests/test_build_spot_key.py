"""Tests for _build_spot_key: maps OCR positions/bets/stacks to Excel spot_key."""

import pytest
from modules.workers.worker_strategy import _build_spot_key


def test_btn_always_returns_btn():
    assert _build_spot_key("BTN", "SB", "BB", {"p1": 0, "p2": 0.5, "p3": 1}, {"is_hu": False}, {"p1": 20, "p2": 15, "p3": 10}) == "BTN"


def test_sb_hu_returns_sbvsbb():
    assert _build_spot_key("SB", "", "BB", {"p1": 0.5, "p2": 0, "p3": 1}, {"is_hu": True}, {"p1": 20, "p2": 0, "p3": 15}) == "SBvsBB"


def test_bb_hu_sb_limp():
    """SB completes to 1bb = limp."""
    assert _build_spot_key("BB", "", "SB", {"p1": 1, "p2": 0, "p3": 1}, {"is_hu": True}, {"p1": 10, "p2": 0, "p3": 8}) == "BBvsSB_LIMP"


def test_bb_hu_sb_minraise():
    """SB raises to 2bb = minraise."""
    assert _build_spot_key("BB", "", "SB", {"p1": 1, "p2": 0, "p3": 2}, {"is_hu": True}, {"p1": 10, "p2": 0, "p3": 8}) == "BBvsSB MR"


def test_bb_hu_sb_allin_stack_zero():
    """SB all-in: stack=0, bet>0."""
    assert _build_spot_key("BB", "", "SB", {"p1": 1, "p2": 0, "p3": 5.12}, {"is_hu": True}, {"p1": 8.68, "p2": 0, "p3": 0}) == "BBvsSB OS"


def test_bb_3h_sb_allin_btn_fold():
    """3H: BTN folds (bet=0), SB all-in (stack=0, bet>0) → same as HU all-in."""
    assert _build_spot_key("BB", "BTN", "SB", {"p1": 1, "p2": 0, "p3": 2}, {"is_hu": False}, {"p1": 12.83, "p2": 13.6, "p3": 0}) == "BBvsSB OS"


def test_bb_3h_btn_limp():
    """3H: BTN limps (bet=1), SB folds."""
    assert _build_spot_key("BB", "BTN", "SB", {"p1": 1, "p2": 1, "p3": 0.5}, {"is_hu": False}, {"p1": 15, "p2": 12, "p3": 10}) == "BBvsBTN L"


def test_bb_3h_btn_minraise():
    """3H: BTN raises to 2bb."""
    assert _build_spot_key("BB", "BTN", "SB", {"p1": 1, "p2": 2, "p3": 0.5}, {"is_hu": False}, {"p1": 15, "p2": 12, "p3": 10}) == "BBvsBTN MR"


def test_sb_3h_btn_limp():
    """3H: BTN limps, hero is SB."""
    assert _build_spot_key("SB", "BB", "BTN", {"p1": 0.5, "p2": 1, "p3": 1}, {"is_hu": False}, {"p1": 15, "p2": 12, "p3": 10}) == "SBvsBTN L"


def test_sb_3h_btn_minraise():
    """3H: BTN minraises, hero is SB."""
    assert _build_spot_key("SB", "BB", "BTN", {"p1": 0.5, "p2": 1, "p3": 2}, {"is_hu": False}, {"p1": 15, "p2": 12, "p3": 10}) == "SBvsBTN MR"
