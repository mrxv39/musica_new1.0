import pytest

from modules.strategy.range_parser import (
    expand_range,
    hand_in_range,
    hand_to_class,
    normalize_hand_class,
)


def test_hand_to_class_and_normalize_formats():
    assert hand_to_class("As", "Qh") == "AQo"
    assert hand_to_class("As", "Qs") == "AQs"
    assert hand_to_class("Ah", "Ad") == "AA"
    assert normalize_hand_class("AsQh") == "AQo"
    assert normalize_hand_class("qAs") == "AQs"
    assert normalize_hand_class("TT") == "TT"
    assert normalize_hand_class("kTo") == "KTo"
    with pytest.raises(ValueError):
        normalize_hand_class("")


def test_expand_range_pairs_plus_and_dash():
    assert expand_range("66+")[:2] == ["66", "77"]
    assert "AA" in expand_range("66+")
    assert expand_range("AA-99") == ["AA", "KK", "QQ", "JJ", "TT", "99"]
    assert expand_range("99-AA") == ["99", "TT", "JJ", "QQ", "KK", "AA"]


def test_expand_range_nonpairs_plus_and_dash():
    assert expand_range("A5s+")[:3] == ["A5s", "A6s", "A7s"]
    assert "AKs" in expand_range("A5s+")
    assert expand_range("A5s-A2s") == ["A5s", "A4s", "A3s", "A2s"]
    # mismatched dash returns empty from dash expander, so only token normalization remains (here it's ignored by expand_range)
    assert expand_range("A5s-K2s") == []


def test_expand_range_wildcards_and_split_tokens():
    assert expand_range("*") == ["*"]
    assert expand_range("ANY") == ["*"]
    assert expand_range("RANDOM") == ["*"]
    assert expand_range("  AKs ;  KQo, TT ") == ["AKs", "KQo", "TT"]


def test_hand_in_range():
    assert hand_in_range("AKs", "A5s+") is True
    assert hand_in_range("A4s", "A5s+") is False
    assert hand_in_range("72o", "ANY") is True
    assert hand_in_range("AKo", "") is False

