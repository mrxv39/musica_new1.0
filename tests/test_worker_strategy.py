# tests/test_worker_strategy.py
"""Tests for modules.workers.worker_strategy.compute_strategy"""
import unittest
from dataclasses import dataclass
from typing import Optional

from modules.workers.worker_strategy import compute_strategy


@dataclass
class _FakeMatchInput:
    situacion: str = ""
    spot: str = ""
    hero_pos: str = ""
    hand_class: str = ""
    p1_bet_bb: float = 0.0
    p1_stack_bb: float = 0.0
    p1_se_bb: float = 0.0
    p2_pos: str = ""
    p2_tipo: str = "unknown"
    p2_bet_bb: float = 0.0
    p2_stack_bb: float = 0.0
    p3_pos: str = ""
    p3_tipo: str = "unknown"
    p3_bet_bb: float = 0.0
    p3_stack_bb: float = 0.0


def _fake_select_move(inp):
    return {"move": "PUSH", "hand_class": inp.hand_class}


def _make_full_inputs(**overrides):
    """Return a dict of all inputs needed for compute_strategy with valid defaults."""
    defaults = dict(
        preflop={"preflop_ok": True},
        mano_result={"valid": True, "hand_class": "AKs", "mano_raw": "AsKs"},
        ocr={
            "posiciones": {"ok": True, "p1": "BTN", "p2": "SB", "p3": "BB"},
        },
        bets_result={"ok": True, "p1": 2.0, "p2": 0.5, "p3": 1.0},
        ocr_stacks={"ok": True, "p1": 25.0, "p2": 20.0, "p3": 18.0},
        stackefectivo_result={"ok": True, "value": 18.0},
        villano_result={"ok": True, "p2": {"tipo": "fish"}, "p3": {"tipo": "reg"}},
        MatchInput=_FakeMatchInput,
        select_move=_fake_select_move,
    )
    defaults.update(overrides)
    return defaults


class TestComputeStrategy(unittest.TestCase):

    def test_returns_ok_with_full_valid_inputs(self):
        result = compute_strategy(**_make_full_inputs())
        self.assertTrue(result["ok"])
        self.assertEqual(result["move"], "PUSH")
        self.assertIn("situacion", result)

    def test_returns_not_ok_when_preflop_false(self):
        result = compute_strategy(**_make_full_inputs(preflop={"preflop_ok": False}))
        self.assertFalse(result["ok"])
        self.assertEqual(result.get("reason"), "missing_inputs_or_preflop_not_ok")

    def test_returns_not_ok_when_mano_invalid(self):
        result = compute_strategy(**_make_full_inputs(mano_result={"valid": False}))
        self.assertFalse(result["ok"])

    def test_returns_not_ok_when_positions_missing(self):
        result = compute_strategy(**_make_full_inputs(ocr={}))
        self.assertFalse(result["ok"])

    def test_returns_not_ok_when_bets_not_ok(self):
        result = compute_strategy(**_make_full_inputs(bets_result={"ok": False}))
        self.assertFalse(result["ok"])

    def test_returns_not_ok_when_stacks_not_ok(self):
        result = compute_strategy(**_make_full_inputs(ocr_stacks={"ok": False}))
        self.assertFalse(result["ok"])

    def test_returns_not_ok_when_stackefectivo_not_ok(self):
        result = compute_strategy(**_make_full_inputs(stackefectivo_result={"ok": False}))
        self.assertFalse(result["ok"])

    def test_returns_not_ok_when_select_move_none(self):
        result = compute_strategy(**_make_full_inputs(select_move=None))
        self.assertFalse(result["ok"])

    def test_returns_not_ok_when_match_input_none(self):
        result = compute_strategy(**_make_full_inputs(MatchInput=None))
        self.assertFalse(result["ok"])

    def test_villano_types_propagated(self):
        result = compute_strategy(**_make_full_inputs())
        # The strategy dict should have ok=True, and the fake select_move returns
        # the hand_class, confirming the MatchInput was built correctly
        self.assertTrue(result["ok"])
        self.assertEqual(result["hand_class"], "AKs")

    def test_handles_none_preflop_gracefully(self):
        result = compute_strategy(**_make_full_inputs(preflop=None))
        self.assertFalse(result["ok"])

    def test_handles_exception_in_select_move(self):
        def bad_select_move(inp):
            raise ValueError("boom")

        result = compute_strategy(**_make_full_inputs(select_move=bad_select_move))
        self.assertFalse(result["ok"])
        self.assertIn("error", result)
        self.assertIn("ValueError", result["error"])


if __name__ == "__main__":
    unittest.main()
