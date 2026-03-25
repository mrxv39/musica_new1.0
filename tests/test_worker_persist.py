# tests/test_worker_persist.py
"""Tests for modules.workers.worker_persist"""
import json
import unittest

from modules.workers.worker_persist import build_ocr_json, _to_float


class TestBuildOcrJson(unittest.TestCase):
    def test_returns_valid_json(self):
        result = build_ocr_json(
            mano_result={"hand_class": "AKs"},
            stacks_result={"p1": 25.0},
            ocr={"posiciones": {"p1": "BTN"}},
            preflop={"preflop_ok": True},
            strategy={"move": "PUSH"},
            tempo_s=0.123,
        )
        parsed = json.loads(result)
        self.assertEqual(parsed["mano"]["hand_class"], "AKs")
        self.assertEqual(parsed["tempo_s"], 0.123)
        self.assertIn("strategy", parsed)

    def test_handles_none_values(self):
        result = build_ocr_json(
            mano_result=None,
            stacks_result=None,
            ocr=None,
            preflop=None,
            strategy=None,
            tempo_s=0.0,
        )
        parsed = json.loads(result)
        self.assertIsNone(parsed["mano"])


class TestToFloat(unittest.TestCase):
    def test_int_to_float(self):
        self.assertEqual(_to_float(5), 5.0)

    def test_float_passthrough(self):
        self.assertEqual(_to_float(3.14), 3.14)

    def test_string_numeric(self):
        self.assertEqual(_to_float("2.5"), 2.5)

    def test_none_returns_none(self):
        self.assertIsNone(_to_float(None))

    def test_empty_string_returns_none(self):
        self.assertIsNone(_to_float(""))

    def test_invalid_string_returns_none(self):
        self.assertIsNone(_to_float("abc"))


if __name__ == "__main__":
    unittest.main()
