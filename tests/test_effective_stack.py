from modules.strategy.effective_stack import compute_effective_stack_bb


def test_compute_effective_stack_bb_keeps_legacy_bb_behavior():
    se = compute_effective_stack_bb(
        posiciones={"p1": "SB", "p2": "BB", "p3": "BTN"},
        stacks={"p1": 9.5, "p2": 14.0, "p3": 20.0},
        bets={"p1": 0.5, "p2": 1.0, "p3": 0.0},
    )

    assert se == 10.0


def test_compute_effective_stack_bb_converts_from_chips_using_inferred_bb():
    se = compute_effective_stack_bb(
        posiciones={"p1": "SB", "p2": "BB", "p3": "BTN"},
        stacks={"p1": 190.0, "p2": 280.0, "p3": 400.0},
        bets={"p1": 10.0, "p2": 20.0, "p3": 0.0},
        bb=20.0,
    )

    assert se == 10.0
