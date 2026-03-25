import pytest

from modules.preflop.link_hands_obs_to_real import (
    canonical_rank_key,
    rank_key_obs,
    rank_key_real,
)


def test_canonical_rank_key_orders_and_normalizes_ten():
    assert canonical_rank_key("A", "K") == "AK"
    assert canonical_rank_key("K", "A") == "AK"
    assert canonical_rank_key("10", "1") == "TT"
    assert canonical_rank_key("1", "10") == "TT"
    assert canonical_rank_key("10", "A") == "AT"
    assert canonical_rank_key("A", "1") == "AT"


def test_canonical_rank_key_returns_none_for_missing_or_invalid_rank():
    assert canonical_rank_key(None, "A") is None
    assert canonical_rank_key("A", None) is None
    assert canonical_rank_key("X", "A") is None


def test_rank_key_obs_extracts_two_valid_ranks():
    assert rank_key_obs("AhKh") == "AK"
    assert rank_key_obs("AcKc") == "AK"
    assert rank_key_obs("2d6c") == "26"
    assert rank_key_obs("10s10h") == "TT"
    assert rank_key_obs("TsTh") == "TT"


@pytest.mark.xfail(reason="rank_key_obs currently parses mano_raw full-card formats, not hand_class shorthand")
def test_rank_key_obs_compact_hand_class_notation():
    assert rank_key_obs("AKs") == "AK"
    assert rank_key_obs("26o") == "26"


def test_rank_key_obs_returns_none_when_two_ranks_cannot_be_extracted():
    assert rank_key_obs("") is None
    assert rank_key_obs(None) is None
    assert rank_key_obs("Ah") is None
    assert rank_key_obs("??") is None


def test_rank_key_real_parses_supported_formats():
    assert rank_key_real("As Ks") == "AK"
    assert rank_key_real("HA HK") == "AK"
    assert rank_key_real("Ah Kh") == "AK"
    assert rank_key_real("2d 6c") == "26"


def test_rank_key_real_returns_none_for_invalid_or_incomplete_cards():
    assert rank_key_real("As") is None
    assert rank_key_real("??? ???") is None
    assert rank_key_real("") is None
