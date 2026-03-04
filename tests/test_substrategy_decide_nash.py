# C:\Users\Usuario\Desktop\proyectos\poker_boss\tests\test_substrategy_decide_nash.py

from modules.strategy.selector_models import MatchInput
from modules.strategy.substrategy_decide import decide_move


def _inp(hand_class: str, se_bb: float) -> MatchInput:
    return MatchInput(
        situacion="ANY",
        spot="ANY",
        hero_pos="BTN",
        hand_class=hand_class,
        p1_bet_bb=0.0,
        p1_stack_bb=10.0,
        p1_se_bb=se_bb,
        p2_pos="SB",
        p2_tipo="fish",
        p2_bet_bb=0.5,
        p2_stack_bb=10.0,
        p3_pos="BB",
        p3_tipo="fish",
        p3_bet_bb=1.0,
        p3_stack_bb=10.0,
    )


def test_nash_pushfold_push_when_inside_range_dict_chart():
    payload = {
        "mode": "NASH_PUSHFOLD",
        "nash": {"chart": {"KQo": {"min": 0, "max": 15}}},
    }
    out = decide_move(payload, _inp("KQo", 4.0))
    assert out["move"] == "PUSH"
    assert out["range_key"] == "NASH"


def test_nash_pushfold_fold_when_outside_range_dict_chart():
    payload = {
        "mode": "NASH_PUSHFOLD",
        "nash": {"chart": {"KQo": {"min": 0, "max": 3}}},
    }
    out = decide_move(payload, _inp("KQo", 4.0))
    assert out["move"] == "FOLD"


def test_nash_pushfold_supports_list_chart_defensive():
    payload = {
        "mode": "NASH_PUSHFOLD",
        "nash": {"chart": [{"hand": "KQo", "min": 0, "max": 15}]},
    }
    out = decide_move(payload, _inp("KQo", 4.0))
    assert out["move"] == "PUSH"
