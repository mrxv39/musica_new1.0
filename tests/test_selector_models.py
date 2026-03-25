# tests/test_selector_models.py
"""Tests for modules.strategy.selector_models — Bounds and MatchInput"""
import unittest

from modules.strategy.selector_models import Bounds, MatchInput


class TestBounds(unittest.TestCase):

    def test_contains_inside(self):
        b = Bounds(lo=10.0, hi=50.0)
        self.assertTrue(b.contains(30.0))

    def test_contains_at_boundary_low(self):
        b = Bounds(lo=10.0, hi=50.0)
        self.assertTrue(b.contains(10.0))

    def test_contains_at_boundary_high(self):
        b = Bounds(lo=10.0, hi=50.0)
        self.assertTrue(b.contains(50.0))

    def test_not_contains_below(self):
        b = Bounds(lo=10.0, hi=50.0)
        self.assertFalse(b.contains(9.9))

    def test_not_contains_above(self):
        b = Bounds(lo=10.0, hi=50.0)
        self.assertFalse(b.contains(50.1))

    def test_distance_inside_is_zero(self):
        b = Bounds(lo=20.0, hi=75.0)
        self.assertEqual(b.distance_to_interval(40.0), 0.0)

    def test_distance_below(self):
        b = Bounds(lo=20.0, hi=75.0)
        self.assertAlmostEqual(b.distance_to_interval(18.0), 2.0)

    def test_distance_above(self):
        b = Bounds(lo=20.0, hi=75.0)
        self.assertAlmostEqual(b.distance_to_interval(80.0), 5.0)

    def test_distance_at_boundary_is_zero(self):
        b = Bounds(lo=20.0, hi=75.0)
        self.assertEqual(b.distance_to_interval(20.0), 0.0)
        self.assertEqual(b.distance_to_interval(75.0), 0.0)

    def test_str_representation(self):
        b = Bounds(lo=5.0, hi=15.0)
        self.assertEqual(str(b), "[5.0, 15.0]")


class TestMatchInput(unittest.TestCase):

    def test_creates_frozen_dataclass(self):
        inp = MatchInput(
            spot="BTN",
            hero_pos="BTN",
            p1_bet_bb=1.0,
            p1_stack_bb=25.0,
            p1_se_bb=20.0,
            p2_pos="SB",
            p2_tipo="fish",
            p2_bet_bb=0.5,
            p2_stack_bb=22.0,
            p3_pos="BB",
            p3_tipo="reg",
            p3_bet_bb=1.0,
            p3_stack_bb=18.0,
            hand_class="AKs",
            situacion="BTN_vs_SB_BB",
        )
        self.assertEqual(inp.spot, "BTN")
        self.assertEqual(inp.hand_class, "AKs")

    def test_is_frozen(self):
        inp = MatchInput(
            spot="BTN", hero_pos="BTN",
            p1_bet_bb=0, p1_stack_bb=0, p1_se_bb=0,
            p2_pos="SB", p2_tipo="fish", p2_bet_bb=0, p2_stack_bb=0,
            p3_pos="BB", p3_tipo="reg", p3_bet_bb=0, p3_stack_bb=0,
            hand_class="AA", situacion="test",
        )
        with self.assertRaises(AttributeError):
            inp.spot = "SB"  # type: ignore


if __name__ == "__main__":
    unittest.main()
