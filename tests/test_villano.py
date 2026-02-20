import unittest
# [test_id:BASE_OCR_Modular]
from unittest.mock import patch
import sqlite3
import tempfile
import os
from modules.ocr import villano
from modules.db import db as dbmod

class TestVillanoOCR(unittest.TestCase):

    def setUp(self):
        # Use a temporary DB file for isolation
        self.db_fd, self.db_path = tempfile.mkstemp(suffix='.sqlite')
        os.environ['MUSICA_DB_PATH'] = self.db_path
        self._connections = []
        def _new_conn():
            conn = sqlite3.connect(self.db_path)
            conn.row_factory = sqlite3.Row
            self._connections.append(conn)
            return conn
        self._get_conn_patch = patch('modules.db.db.get_conn', _new_conn)
        self._get_conn_patch.start()
        dbmod.init_db()

    def tearDown(self):
        self._get_conn_patch.stop()
        for conn in self._connections:
            try:
                conn.close()
            except Exception:
                pass
        os.close(self.db_fd)
        os.remove(self.db_path)
        if 'MUSICA_DB_PATH' in os.environ:
            del os.environ['MUSICA_DB_PATH']

    @patch('modules.ocr.names.read_names')
    def test_missing_player_inserted(self, mock_read_names):
        mock_read_names.return_value = {'p2_name': 'Fishy', 'p3_name': ''}
        out = villano.classify_villano('dummy.png')
        self.assertTrue(out['ok'])
        self.assertEqual(out['p2']['name'], 'Fishy')
        self.assertEqual(out['p2']['tipo'], 'fish')
        self.assertIn('p2', out['created'])
        self.assertEqual(out['p3']['name'], '')
        self.assertEqual(out['p3']['tipo'], '')
        # Check DB
        conn = dbmod.get_conn()
        row = conn.execute('SELECT tipo FROM players WHERE name=?', ('Fishy',)).fetchone()
        self.assertEqual(row[0], 'fish')

    @patch('modules.ocr.names.read_names')
    def test_existing_player_tipo_not_overwritten(self, mock_read_names):
        # Pre-insert a player with tipo 'reg'
        conn = dbmod.get_conn()
        conn.execute("INSERT INTO players (name, tipo) VALUES (?, ?)", ('RegPlayer', 'reg'))
        conn.commit()
        mock_read_names.return_value = {'p2_name': 'RegPlayer', 'p3_name': ''}
        out = villano.classify_villano('dummy.png')
        self.assertTrue(out['ok'])
        self.assertEqual(out['p2']['name'], 'RegPlayer')
        self.assertEqual(out['p2']['tipo'], 'reg')
        self.assertNotIn('p2', out['created'])
        # Ensure tipo not overwritten
        row = conn.execute('SELECT tipo FROM players WHERE name=?', ('RegPlayer',)).fetchone()
        self.assertEqual(row[0], 'reg')

    @patch('modules.ocr.names.read_names')
    def test_both_names_empty(self, mock_read_names):
        mock_read_names.return_value = {'p2_name': '', 'p3_name': ''}
        out = villano.classify_villano('dummy.png')
        self.assertFalse(out['ok'])
        self.assertIn('no_valid_names', out['errors'])
        self.assertEqual(out['p2']['name'], '')
        self.assertEqual(out['p3']['name'], '')

if __name__ == '__main__':
    unittest.main()
