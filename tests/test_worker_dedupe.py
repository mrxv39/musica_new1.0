import unittest
# [test_id:BASE_PersistWithoutStack]
# [test_id:BASE_Dedupe]
import tempfile
import os
import sys
import json
import hashlib
from unittest.mock import patch

import modules.db.db as dbmod


class TestWorkerDedupeAndPersist(unittest.TestCase):
    def setUp(self):
        # Do NOT use ":memory:" if dbmod opens multiple connections.
        # Use a real temp file so all connections see the same DB.
        self.tmpdb = tempfile.NamedTemporaryFile(delete=False, suffix=".db")
        self.tmpdb.close()
        self.db_path = self.tmpdb.name
        os.environ["MUSICA_DB_PATH"] = self.db_path
        dbmod.init_db()

        # Create a temp file to use as --image (must exist)
        self.tmpimg = tempfile.NamedTemporaryFile(delete=False, suffix=".png")
        self.tmpimg.write(b"\x89PNG\r\n\x1a\n")
        self.tmpimg.close()
        self.image_path = self.tmpimg.name

    def tearDown(self):
        try:
            os.unlink(self.image_path)
        except Exception:
            pass
        try:
            os.unlink(self.db_path)
        except Exception:
            pass
        try:
            del os.environ["MUSICA_DB_PATH"]
        except KeyError:
            pass

    def _obs_count(self) -> int:
        conn = dbmod.get_conn()
        try:
            cur = conn.cursor()
            cur.execute("SELECT COUNT(*) FROM hands_obs")
            return int(cur.fetchone()[0])
        finally:
            conn.close()

    def _obs_by_fp(self, fp: str):
        return dbmod.get_obs_by_fingerprint(fp)

    def _run_worker_and_capture(self, preflop_results, ticks=2):
        """
        Run worker.main() with patched run_preflop that returns controlled results.
        Capture stdout JSON lines into a list of dicts.
        """
        from modules.workers import worker

        def fake_run_preflop(_):
            if len(preflop_results) > 1:
                return preflop_results.pop(0)
            return preflop_results[0]

        argv = [
            "worker.py",
            "--id", "1",
            "--image", self.image_path,
            "--max_ticks", str(ticks),
            "--interval_ms", "1",
            "--print_every_tick", "true",
        ]

        outputs = []
        with patch.object(sys, "argv", argv):
            # IMPORTANT: worker.main() calls worker_loop.run_loop(),
            # and worker_loop imports run_preflop at module level.
            with patch("modules.workers.worker_loop.run_preflop", side_effect=fake_run_preflop):
                from io import StringIO
                old_stdout = sys.stdout
                sys.stdout = mystdout = StringIO()
                try:
                    worker.main()
                finally:
                    sys.stdout = old_stdout

        for line in mystdout.getvalue().splitlines():
            try:
                outputs.append(json.loads(line))
            except Exception:
                pass
        return outputs

    # ----------------------------
    # DEDUPE tests
    # ----------------------------
    def test_dedupe_skips_on_same_hand_and_stack(self):
        mano = {"valid": True, "mano_raw": "AcKd"}
        stacks = {"p1": 100.0}
        preflop1 = {"modules": {"mano": mano, "stacks": stacks}, "preflop_ok": True}
        preflop2 = {"modules": {"mano": mano, "stacks": stacks}, "preflop_ok": True}

        outs = self._run_worker_and_capture([preflop1, preflop2], ticks=2)

        self.assertEqual(len(outs), 2)
        self.assertFalse(outs[0]["dedupe_skipped"])
        self.assertTrue(outs[1]["dedupe_skipped"])
        self.assertEqual(outs[1]["dedupe_reason"], "duplicate_hand")

    def test_dedupe_not_skipped_on_stack_change(self):
        mano = {"valid": True, "mano_raw": "AcKd"}
        stacks1 = {"p1": 100.0}
        stacks2 = {"p1": 200.0}
        preflop1 = {"modules": {"mano": mano, "stacks": stacks1}, "preflop_ok": True}
        preflop2 = {"modules": {"mano": mano, "stacks": stacks2}, "preflop_ok": True}

        outs = self._run_worker_and_capture([preflop1, preflop2], ticks=2)

        self.assertEqual(len(outs), 2)
        self.assertFalse(outs[0]["dedupe_skipped"])
        self.assertFalse(outs[1]["dedupe_skipped"])

    def test_dedupe_no_dedupe_on_invalid_or_missing(self):
        mano1 = {"valid": False, "mano_raw": "AcKd"}
        stacks1 = {"p1": 100.0}

        mano2 = {"valid": True, "mano_raw": "AcKd"}
        stacks2 = {"p1": None}

        preflop1 = {"modules": {"mano": mano1, "stacks": stacks1}, "preflop_ok": True}
        preflop2 = {"modules": {"mano": mano2, "stacks": stacks2}, "preflop_ok": True}

        outs = self._run_worker_and_capture([preflop1, preflop2], ticks=2)

        self.assertEqual(len(outs), 2)
        self.assertEqual(outs[0]["dedupe_reason"], "no_dedupe")
        self.assertFalse(outs[0]["dedupe_skipped"])
        self.assertEqual(outs[1]["dedupe_reason"], "no_dedupe")
        self.assertFalse(outs[1]["dedupe_skipped"])

    # ----------------------------
    # PERSIST tests
    # ----------------------------
    def test_persist_only_new_hand(self):
        mano = {"valid": True, "mano_raw": "AcKd"}
        stacks = {"p1": 100.0}

        preflop1 = {"modules": {"mano": mano, "stacks": stacks}, "preflop_ok": True}
        preflop2 = {"modules": {"mano": mano, "stacks": stacks}, "preflop_ok": True}

        outs = self._run_worker_and_capture([preflop1, preflop2], ticks=2)
        self.assertEqual(len(outs), 2)

        self.assertEqual(self._obs_count(), 1)

        fp = hashlib.sha1("AcKd|100.0".encode("utf-8")).hexdigest()
        obs = self._obs_by_fp(fp)
        self.assertIsNotNone(obs)
        self.assertEqual(obs.get("mano_raw"), "AcKd")

    def test_no_insert_on_invalid_hand(self):
        mano = {"valid": False, "mano_raw": "AcKd"}
        stacks = {"p1": 100.0}
        preflop1 = {"modules": {"mano": mano, "stacks": stacks}, "preflop_ok": True}

        self._run_worker_and_capture([preflop1], ticks=1)
        self.assertEqual(self._obs_count(), 0)

    def test_no_insert_on_stack_zero(self):
        mano = {"valid": True, "mano_raw": "AcKd"}
        stacks = {"p1": 0}
        preflop1 = {"modules": {"mano": mano, "stacks": stacks}, "preflop_ok": True}

        self._run_worker_and_capture([preflop1], ticks=1)
        self.assertEqual(self._obs_count(), 0)

    def test_insert_on_new_signature(self):
        mano1 = {"valid": True, "mano_raw": "AcKd"}
        stacks1 = {"p1": 100.0}
        mano2 = {"valid": True, "mano_raw": "QsJh"}
        stacks2 = {"p1": 200.0}

        preflop1 = {"modules": {"mano": mano1, "stacks": stacks1}, "preflop_ok": True}
        preflop2 = {"modules": {"mano": mano2, "stacks": stacks2}, "preflop_ok": True}

        self._run_worker_and_capture([preflop1, preflop2], ticks=2)

        self.assertEqual(self._obs_count(), 2)

        fp1 = hashlib.sha1("AcKd|100.0".encode("utf-8")).hexdigest()
        fp2 = hashlib.sha1("QsJh|200.0".encode("utf-8")).hexdigest()
        self.assertIsNotNone(self._obs_by_fp(fp1))
        self.assertIsNotNone(self._obs_by_fp(fp2))


if __name__ == "__main__":
    unittest.main()
