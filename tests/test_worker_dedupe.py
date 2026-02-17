
import unittest
import tempfile
import os
import sys
import json
from unittest.mock import patch

class TestWorkerDedupe(unittest.TestCase):
    def setUp(self):
        # Create a temp file to use as --image (must exist)
        self.tmpfile = tempfile.NamedTemporaryFile(delete=False, suffix=".png")
        self.tmpfile.write(b"\x89PNG\r\n\x1a\n")
        self.tmpfile.close()
        self.image_path = self.tmpfile.name

    def tearDown(self):
        try:
            os.unlink(self.image_path)
        except Exception:
            pass

    def run_worker_and_capture(self, preflop_results, ticks=2):
        # Patch run_preflop to return controlled results per tick
        from modules.workers import worker
        outputs = []
        def fake_run_preflop(_):
            # Pop first, or repeat last
            if len(preflop_results) > 1:
                return preflop_results.pop(0)
            return preflop_results[0]
        argv = ["worker.py", "--id", "1", "--image", self.image_path, "--max_ticks", str(ticks), "--interval_ms", "1", "--print_every_tick", "true"]
        with patch.object(sys, "argv", argv):
            with patch("modules.workers.worker.run_preflop", side_effect=fake_run_preflop):
                from io import StringIO
                old_stdout = sys.stdout
                sys.stdout = mystdout = StringIO()
                try:
                    worker.main()
                finally:
                    sys.stdout = old_stdout
        # Parse each JSON line
        for line in mystdout.getvalue().splitlines():
            try:
                outputs.append(json.loads(line))
            except Exception:
                pass
        return outputs

    def test_dedupe_skips_on_same_hand_and_stack(self):
        # First tick: mano_raw=AcKd, p1=100.0; Second tick: same
        mano = {"valid": True, "mano_raw": "AcKd"}
        stacks = {"p1": 100.0}
        preflop1 = {"modules": {"mano": mano, "stacks": stacks}, "preflop_ok": True}
        preflop2 = {"modules": {"mano": mano, "stacks": stacks}, "preflop_ok": True}
        outs = self.run_worker_and_capture([preflop1, preflop2], ticks=2)
        self.assertEqual(len(outs), 2)
        self.assertFalse(outs[0]["dedupe_skipped"])
        self.assertEqual(outs[1]["dedupe_skipped"], True)
        self.assertEqual(outs[1]["dedupe_reason"], "duplicate_hand")

    def test_dedupe_not_skipped_on_stack_change(self):
        mano = {"valid": True, "mano_raw": "AcKd"}
        stacks1 = {"p1": 100.0}
        stacks2 = {"p1": 200.0}
        preflop1 = {"modules": {"mano": mano, "stacks": stacks1}, "preflop_ok": True}
        preflop2 = {"modules": {"mano": mano, "stacks": stacks2}, "preflop_ok": True}
        outs = self.run_worker_and_capture([preflop1, preflop2], ticks=2)
        self.assertEqual(len(outs), 2)
        self.assertFalse(outs[0]["dedupe_skipped"])
        self.assertFalse(outs[1]["dedupe_skipped"])

    def test_dedupe_no_dedupe_on_invalid_or_missing(self):
        # mano valid False
        mano1 = {"valid": False, "mano_raw": "AcKd"}
        stacks1 = {"p1": 100.0}
        # p1 None
        mano2 = {"valid": True, "mano_raw": "AcKd"}
        stacks2 = {"p1": None}
        preflop1 = {"modules": {"mano": mano1, "stacks": stacks1}, "preflop_ok": True}
        preflop2 = {"modules": {"mano": mano2, "stacks": stacks2}, "preflop_ok": True}
        outs = self.run_worker_and_capture([preflop1, preflop2], ticks=2)
        self.assertEqual(len(outs), 2)
        self.assertEqual(outs[0]["dedupe_reason"], "no_dedupe")
        self.assertFalse(outs[0]["dedupe_skipped"])
        self.assertEqual(outs[1]["dedupe_reason"], "no_dedupe")
        self.assertFalse(outs[1]["dedupe_skipped"])

if __name__ == "__main__":
    unittest.main()
