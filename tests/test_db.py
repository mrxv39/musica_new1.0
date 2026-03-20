import unittest
from modules.db import db


class TestDB(unittest.TestCase):
    def setUp(self):
        db.init_db()

    def test_schema_spots_exists(self):
        conn = db.get_conn()
        cur = conn.cursor()
        cur.execute('SELECT name FROM sqlite_master WHERE type="table" AND name="spots"')
        self.assertIsNotNone(cur.fetchone())
        conn.close()

    def test_insert_obs(self):
        obs_id = db.insert_obs(
            fingerprint="test_fp_123",
            table_id="mesa_1",
            detected_at_ms=1000,
            mano_raw="AcKd",
            hand_class="AKo",
            preflop_ok=True,
            ocr_json='{"test": 1}',
        )
        self.assertIsInstance(obs_id, int)
        # Inserting same fingerprint returns same id
        obs_id2 = db.insert_obs(
            fingerprint="test_fp_123",
            table_id="mesa_1",
            detected_at_ms=1000,
            mano_raw="AcKd",
            hand_class="AKo",
            preflop_ok=True,
            ocr_json='{"test": 1}',
        )
        self.assertEqual(obs_id, obs_id2)


if __name__ == "__main__":
    unittest.main()
