"""
Integration test: runs the full worker pipeline on a real mesa image.

Uses a known-good image that passes preflop + OCR + strategy.
If this test fails, the worker pipeline is broken end-to-end.

DO NOT modify this test to make it pass — fix the production code.
"""
import os
import sys
import unittest

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

SAMPLE_IMAGE = r"C:\Users\Usuario\Desktop\PREFLOP\3H\BTN\ok\screenshot_20260202072433879.bmp"


@unittest.skipUnless(os.path.exists(SAMPLE_IMAGE), "Sample image not found")
class TestFullPipelineOnRealImage(unittest.TestCase):
    """End-to-end: image → preflop → OCR → strategy fields present."""

    def test_preflop_detects_cards_and_no_board(self):
        """Preflop must detect valid cards and confirm no board."""
        from modules.workers.worker_preflop import run_preflop

        result = run_preflop(SAMPLE_IMAGE)

        self.assertTrue(result["preflop_ok"], "preflop_ok must be True")
        mods = result["modules"]
        self.assertTrue(mods["mano"]["valid"], "mano must be valid")
        self.assertIsNotNone(mods["mano"]["hand_class"], "hand_class must be set")
        self.assertTrue(mods["noboard"]["noboard_ok"], "noboard_ok must be True")

    def test_ocr_extracts_all_required_fields(self):
        """OCR must extract names, villano types, stacks, bets, SE, positions."""
        from modules.ocr.ocr import run_ocr

        ocr = run_ocr(SAMPLE_IMAGE)

        # Names
        self.assertTrue(ocr["names"]["ok"])
        self.assertTrue(len(ocr["names"]["p2_name"]) > 0)
        self.assertTrue(len(ocr["names"]["p3_name"]) > 0)

        # Villano types
        self.assertTrue(ocr["villano"]["ok"])
        self.assertIn(ocr["villano"]["p2"]["tipo"], ["fish", "reg", "shark", "unknown"])
        self.assertIn(ocr["villano"]["p3"]["tipo"], ["fish", "reg", "shark", "unknown"])

        # Stack efectivo
        self.assertTrue(ocr["stackefectivo"]["ok"])
        self.assertIsInstance(ocr["stackefectivo"]["value"], (int, float))
        self.assertGreater(ocr["stackefectivo"]["value"], 0)

        # Bets
        self.assertTrue(ocr["bets"]["ok"])
        for key in ["p1", "p2", "p3"]:
            self.assertIsInstance(ocr["bets"][key], (int, float))

        # Stacks
        self.assertTrue(ocr["stacks"]["ok"])

        # Positions
        self.assertTrue(ocr["posiciones"]["ok"])
        positions = {ocr["posiciones"]["p1"], ocr["posiciones"]["p2"], ocr["posiciones"]["p3"]}
        self.assertEqual(positions, {"BTN", "SB", "BB"})

        # Dealer
        self.assertTrue(ocr["dealer"]["ok"])

    def test_image_size_matches_mesa_region(self):
        """Sample image must be 776x597 (same as mesa capture region)."""
        from PIL import Image

        img = Image.open(SAMPLE_IMAGE)
        self.assertEqual(img.size, (776, 597))

    def test_preflop_plus_ocr_produces_overlay_data(self):
        """Combined preflop + OCR must produce all fields needed by overlay:
        move (from strategy), bet min/max, mano, SE."""
        from modules.workers.worker_preflop import run_preflop
        from modules.ocr.ocr import run_ocr

        pf = run_preflop(SAMPLE_IMAGE)
        ocr = run_ocr(SAMPLE_IMAGE)

        # These are the fields the overlay needs
        hand_class = pf["modules"]["mano"]["hand_class"]
        se = ocr["stackefectivo"]["value"]
        p1_pos = ocr["posiciones"]["p1"]

        self.assertIsNotNone(hand_class, "hand_class required for overlay")
        self.assertGreater(se, 0, "SE required for overlay")
        self.assertIn(p1_pos, ["BTN", "SB", "BB"], "position required for strategy matching")


@unittest.skipUnless(os.path.exists(SAMPLE_IMAGE), "Sample image not found")
class TestCaptureRegionMatchesImageSize(unittest.TestCase):
    """Verify that capture regions produce images matching expected dimensions."""

    def test_all_mesa_regions_produce_776x597(self):
        """All 4 mesa regions must produce 776x597 images."""
        from modules.preflop.workers_loop.config import AREAS

        for area in AREAS:
            w = area["x2"] - area["x1"]
            h = area["y2"] - area["y1"]
            self.assertEqual((w, h), (776, 597),
                f"Mesa {area['mesa']} region must be 776x597, got {w}x{h}")


if __name__ == "__main__":
    unittest.main()
