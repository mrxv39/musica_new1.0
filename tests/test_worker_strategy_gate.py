import types

from modules.workers.worker_strategy import _as_float, _fix_bets_for_matching, compute_strategy


def test_as_float_and_fix_bets_for_matching():
    assert _as_float(None, 7.0) == 7.0
    assert _as_float("", 7.0) == 7.0
    assert _as_float("3.5") == 3.5
    assert _as_float("bad", 9.0) == 9.0

    fixed = _fix_bets_for_matching("BTN", {"p1": "3.0", "p2": 0.5, "p3": 1.0})
    assert fixed["p1_raw"] == 3.0
    assert fixed["p1_used"] == 0.0
    assert fixed["reason"] == "btn_unacted_p1_bet_looks_like_pot"

    unchanged = _fix_bets_for_matching("SB", {"p1": "3.0", "p2": 0.5, "p3": 1.0})
    assert unchanged["p1_used"] == 3.0
    assert unchanged["reason"] == ""


def test_compute_strategy_returns_decision_with_normalized_villains():
    captured = {}

    def fake_match_input(**kwargs):
        captured.update(kwargs)
        return types.SimpleNamespace(**kwargs)

    def fake_select_move(inp):
        assert inp.hand_class == "AKs"
        return {"move": "CALL", "range_key": "OR_TO_CALL_ANY"}

    out = compute_strategy(
        preflop={"preflop_ok": True},
        mano_result={"valid": True, "hand_class": "AKs"},
        ocr={"posiciones": {"ok": True, "p1": "BTN", "p2": "SB", "p3": "BB"}},
        bets_result={"ok": True, "p1": 3.0, "p2": 0.5, "p3": 1.0},
        ocr_stacks={"ok": True, "p1": 15.0, "p2": 20.0, "p3": 18.0},
        stackefectivo_result=None,
        villano_result={"ok": True, "p2": {"tipo": "fish"}, "p3": {"tipo": " reg "}},
        MatchInput=fake_match_input,
        select_move=fake_select_move,
    )

    assert out["ok"] is True
    assert out["move"] == "CALL"
    assert out["situacion"] == "BTN_vs_SB_BB_FISH_REG"
    assert out["bets_p1_raw"] == 3.0
    assert out["bets_p1_used"] == 0.0
    assert out["bets_fix_reason"] == "btn_unacted_p1_bet_looks_like_pot"
    assert out["se_method"] == "derived"
    # SE derived from total stacks (behind + committed): min(15.0+3.0, max(20.0+0.5, 18.0+1.0)) = min(18.0, 20.5) = 18.0
    assert out["se_used"] == 18.0
    assert captured["p2_tipo"] == "FISH"
    assert captured["p3_tipo"] == "REG"


def test_compute_strategy_returns_missing_inputs_reason_when_requirements_fail():
    out = compute_strategy(
        preflop={"preflop_ok": False},
        mano_result={"valid": False},
        ocr={"posiciones": {"ok": False}},
        bets_result={"ok": False, "p1": "x"},
        ocr_stacks={"ok": False},
        stackefectivo_result=None,
        villano_result={},
        MatchInput=None,
        select_move=None,
    )

    assert out["ok"] is False
    assert out["reason"] == "missing_inputs_or_preflop_not_ok"
    assert out["preflop_ok"] is False
    assert out["mano_ok"] is False
    assert out["pos_ok"] is False
    assert out["bets_ok"] is False
    assert out["stacks_ok"] is False
    assert out["bets_p1_raw"] == 0.0
    assert out["se_method"] == "none"


def test_compute_strategy_catches_select_move_errors():
    def fake_match_input(**kwargs):
        return types.SimpleNamespace(**kwargs)

    def boom(_inp):
        raise RuntimeError("selector exploded")

    out = compute_strategy(
        preflop={"preflop_ok": True},
        mano_result={"valid": True, "hand_class": "AKs"},
        ocr={"posiciones": {"ok": True, "p1": "SB", "p2": "BB", "p3": "BTN"}},
        bets_result={"ok": True, "p1": 0.5, "p2": 1.0, "p3": 0.0},
        ocr_stacks={"ok": True, "p1": 9.5, "p2": 14.0, "p3": 20.0},
        stackefectivo_result=None,
        villano_result={},
        MatchInput=fake_match_input,
        select_move=boom,
    )

    assert out["ok"] is False
    assert out["error"] == "RuntimeError: selector exploded"
    assert out["se_derived"] == 10.0
    assert out["se_used"] == 10.0
    assert out["se_method"] == "derived"
