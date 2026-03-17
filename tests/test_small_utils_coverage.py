import numpy as np

from modules.ocr.bets import bets_cache, bets_parse, bets_preprocess
from modules.preflop.workers_loop import preflop_logic


def test_bets_cache_roundtrip_and_fp_miss():
    bets_cache.clear_cache()
    assert bets_cache.get_cached("p1", 1) is None

    bets_cache.set_cached("p1", 1, 3.5, "3,5", "otsu", True)
    assert bets_cache.get_cached("p1", 2) is None  # fp mismatch
    v, raw, method, ok = bets_cache.get_cached("p1", 1)
    assert v == 3.5
    assert raw == "3,5"
    assert method == "otsu"
    assert ok is True


def test_bets_parse_clean_parse_score_confidence():
    # clean_numeric_text removes everything but digits/dots; comma is removed (normalization happens in parse_float)
    assert bets_parse.clean_numeric_text(" 1O,5bb ") == "15"
    assert bets_parse.parse_float("x") is None
    assert bets_parse.parse_float(" 2,50 ") == 2.5

    cleaned = bets_parse.clean_numeric_text("..12..3..")
    val = bets_parse.parse_float(cleaned)
    assert cleaned == ".123"
    # parse_float extracts a numeric substring; current regex treats ".123" as "123"
    assert val == 123.0
    assert bets_parse.score_candidate(cleaned, val) > bets_parse.score_candidate(cleaned, None)
    assert bets_parse.is_confident(cleaned, val) is True
    assert bets_parse.is_confident("", None) is False


def test_bets_preprocess_iter_variants_shapes_and_names():
    gray_small = np.zeros((10, 10), dtype=np.uint8)
    variants = list(bets_preprocess.iter_variants(gray_small))
    assert [name for (name, _img) in variants] == ["thr200", "otsu", "thr200_inv", "otsu_inv"]
    # very small image should be upscaled x3
    assert variants[0][1].shape[0] == 30
    assert variants[0][1].shape[1] == 30

    gray_big = np.zeros((30, 60), dtype=np.uint8)
    variants2 = list(bets_preprocess.iter_variants(gray_big))
    assert variants2[0][1].shape == gray_big.shape


def test_preflop_logic_preflop_fail_and_has_move_bets():
    assert preflop_logic.preflop_fail(None) is True
    assert preflop_logic.preflop_fail({"preflop_ok": False}) is True
    assert (
        preflop_logic.preflop_fail(
            {"preflop_ok": True, "modules": {"mano": {"valid": True}, "noboard": {"noboard_ok": True}}}
        )
        is False
    )
    assert preflop_logic.preflop_fail({"preflop_ok": True, "modules": {"mano": {"valid": False}}}) is True

    assert preflop_logic.has_move_bets({"ok": True, "move": "OR", "betmin": 2, "betmax": 5}) is True
    assert preflop_logic.has_move_bets({"ok": True, "move": "", "betmin": 2, "betmax": 5}) is False
    assert preflop_logic.has_move_bets({"ok": False, "move": "OR", "betmin": 2, "betmax": 5}) is False

