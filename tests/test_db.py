import unittest
# [test_id:BASE_DB_Structured]
import os
import json
from modules.db import db

class TestDB(unittest.TestCase):
    def setUp(self):
        db.init_db()
    def test_insert_hand(self):
        fingerprint = 'test_fp_123'
        data = json.dumps({'test': 1})
        hand_id1 = db.insert_hand(fingerprint, data)
        hand_id2 = db.insert_hand(fingerprint, data)
        self.assertEqual(hand_id1, hand_id2)
        self.assertIsInstance(hand_id1, int)
    def test_schema(self):
        conn = db.get_conn()
        cur = conn.cursor()
        cur.execute('SELECT name FROM sqlite_master WHERE type="table" AND name="hands"')
        self.assertIsNotNone(cur.fetchone())
        conn.close()

if __name__ == '__main__':
    unittest.main()
