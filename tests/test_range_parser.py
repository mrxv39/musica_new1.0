# C:\Users\Usuario\Desktop\proyectos\poker_boss\tests\test_range_parser.py

from modules.strategy.range_parser import expand_range, hand_in_range


def test_expand_pairs_dash_descending_includes_tt():
    assert expand_range("AA-99") == ["AA", "KK", "QQ", "JJ", "TT", "99"]


def test_expand_pairs_dash_ascending_includes_tt():
    assert expand_range("99-AA") == ["99", "TT", "JJ", "QQ", "KK", "AA"]


def test_hand_in_range_pairs_dash():
    assert hand_in_range("TT", "AA-99") is True
    assert hand_in_range("88", "AA-99") is False


def test_hand_in_range_multiple_tokens():
    assert hand_in_range("TT", "AA-99,AKs") is True
    assert hand_in_range("AKs", "AA-99,AKs") is True
    assert hand_in_range("AQs", "AA-99,AKs") is False


def test_expand_pairs_dash_descending_full_set():
    xs = expand_range("AA-22")
    assert xs[0] == "AA"
    assert xs[-1] == "22"
    assert len(xs) == 13
    assert "TT" in xs
    assert "99" in xs
    assert "22" in xs


def test_plus_pairs_from_99_contains_aa_and_99():
    xs = expand_range("99+")
    assert "99" in xs
    assert "TT" in xs
    assert "AA" in xs
