import unittest
# [test_id:STACKS_QUANTIZE]
from modules.ocr.stacks_quantize import (
    quantize_stack,
    quantize_stacks_result,
    MAX_STACK_BB,
    MIN_STACK_BB,
    TOTAL_CHIPS_BB,
)


class TestQuantizeStack(unittest.TestCase):
    """Individual stack decimal-shift correction."""

    def test_normal_value_unchanged(self):
        """25BB is perfectly valid, no correction."""
        self.assertEqual(quantize_stack(25.0), 25.0)

    def test_small_value_unchanged(self):
        """1BB stack is valid (short-stacked)."""
        self.assertEqual(quantize_stack(1.0), 1.0)

    def test_max_value_unchanged(self):
        """75BB = all chips, valid."""
        self.assertEqual(quantize_stack(75.0), 75.0)

    def test_decimal_shift_down_10(self):
        """245 → 24.5 (missing decimal, /10)."""
        self.assertEqual(quantize_stack(245.0), 24.5)

    def test_decimal_shift_down_100(self):
        """2450 → 24.5 (/10=245 still >75, /100=24.5)."""
        self.assertEqual(quantize_stack(2450.0), 24.5)

    def test_value_too_high_shift_works(self):
        """500 → 50.0 (/10 is valid)."""
        self.assertEqual(quantize_stack(500.0), 50.0)

    def test_zero_stays_zero(self):
        self.assertEqual(quantize_stack(0.0), 0.0)

    def test_very_small_upshift(self):
        """0.25 is below MIN_STACK_BB(0.5), but 2.5 is valid."""
        self.assertEqual(quantize_stack(0.25), 2.5)

    def test_negative_becomes_zero(self):
        self.assertEqual(quantize_stack(-5.0), 0.0)


class TestQuantizeStacksResult(unittest.TestCase):
    """Full result dict correction with conservation check."""

    def _make_result(self, p1, p2, p3, ok=True):
        return {
            "ok": ok,
            "p1": p1, "p2": p2, "p3": p3,
            "raw": {"p1": "", "p2": "", "p3": ""},
            "method": {"p1": "otsu", "p2": "otsu", "p3": "otsu"},
            "errors": [],
        }

    def test_all_normal_unchanged(self):
        """All stacks ~25BB, no correction needed."""
        r = self._make_result(25.0, 24.5, 25.5)
        quantize_stacks_result(r)
        self.assertEqual(r["p1"], 25.0)
        self.assertEqual(r["p2"], 24.5)
        self.assertEqual(r["p3"], 25.5)

    def test_one_shifted_individual_fix(self):
        """p2 reads 245 instead of 24.5 — fixed by individual check."""
        r = self._make_result(25.0, 245.0, 25.0)
        quantize_stacks_result(r)
        self.assertEqual(r["p2"], 24.5)

    def test_conservation_catches_remaining_error(self):
        """Two stacks are 100 (→10 each), third is 55.
        Individual fix: 100→10, 100→10. Sum=10+10+55=75. Perfect."""
        r = self._make_result(100.0, 100.0, 55.0)
        quantize_stacks_result(r)
        self.assertEqual(r["p1"], 10.0)
        self.assertEqual(r["p2"], 10.0)
        self.assertEqual(r["p3"], 55.0)

    def test_not_ok_result_passthrough(self):
        """If ok=False, don't touch anything."""
        r = self._make_result(999.0, 888.0, 777.0, ok=False)
        quantize_stacks_result(r)
        self.assertEqual(r["p1"], 999.0)

    def test_conservation_fix_one_outlier(self):
        """p1=25, p2=25, p3=250. Individual: p3→25.0.
        Total would be 75, perfect."""
        r = self._make_result(25.0, 25.0, 250.0)
        quantize_stacks_result(r)
        self.assertEqual(r["p3"], 25.0)

    def test_realistic_mid_tournament(self):
        """p1=40, p2=15, p3=20 — sum=75, all valid, no changes."""
        r = self._make_result(40.0, 15.0, 20.0)
        quantize_stacks_result(r)
        self.assertEqual(r["p1"], 40.0)
        self.assertEqual(r["p2"], 15.0)
        self.assertEqual(r["p3"], 20.0)

    def test_all_starting_stacks(self):
        """Start of tournament: all 25BB."""
        r = self._make_result(25.0, 25.0, 25.0)
        quantize_stacks_result(r)
        self.assertEqual(r["p1"], 25.0)
        self.assertEqual(r["p2"], 25.0)
        self.assertEqual(r["p3"], 25.0)

    def test_two_players_heads_up(self):
        """HU: one player busted, p3=0. p1+p2 should ≈ 75."""
        r = self._make_result(50.0, 25.0, 0.0)
        r["ok"] = True
        quantize_stacks_result(r)
        self.assertEqual(r["p1"], 50.0)
        self.assertEqual(r["p2"], 25.0)


if __name__ == "__main__":
    unittest.main()
