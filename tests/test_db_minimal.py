# C:\Users\Usuario\Desktop\proyectos\musica_new\tests\test_db_minimal.py

import os
import json
import unittest
import tempfile

from modules.db import db


class TestDBMinimal(unittest.TestCase):
    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.db_path = os.path.join(self.tmpdir.name, "test_musica_new.db")
        os.environ["MUSICA_DB_PATH"] = self.db_path
        db.init_db()

    def tearDown(self):
        try:
            del os.environ["MUSICA_DB_PATH"]
        except KeyError:
            pass
        self.tmpdir.cleanup()

    def test_insert_obs_idempotent(self):
        fp = "obs_fp_1"
        obs1 = db.insert_obs(
            fingerprint=fp,
            table_id="mesa1",
            detected_at_ms=1000,
            mano_raw="AsKs",
            hand_class="AKs",
            time_str="12:34",
            preflop_ok=True,
            noboard_ok=True,
            ocr_json=json.dumps({"stacks": [10, 20, 30]}),
            frame_ref="frame_001.png",
        )
        obs2 = db.insert_obs(
            fingerprint=fp,
            table_id="mesa1",
            detected_at_ms=1001,
        )
        self.assertEqual(obs1, obs2)

        row = db.get_obs_by_fingerprint(fp)
        self.assertIsNotNone(row)
        self.assertEqual(row["table_id"], "mesa1")
        self.assertEqual(row["mano_raw"], "AsKs")

    def test_upsert_xml_game(self):
        gc = "GAME123"
        db.upsert_xml_game(
            gamecode=gc,
            sessioncode="S1",
            startdate="2026-02-17 10:00:00",
            smallblind="0.5",
            bigblind="1",
            hero_reg_code="8572127273",
            hero_name="xavieeee2",
            hero_seat="1",
            hero_cards="AsKs",
            board_flop="AhKd2c",
            players_json=json.dumps([{"seat": 1, "name": "x"}]),
            actions_json=json.dumps([{"round": 1, "a": "call"}]),
        )
        row = db.get_xml_by_gamecode(gc)
        self.assertIsNotNone(row)
        self.assertEqual(row["sessioncode"], "S1")

        # update
        db.upsert_xml_game(gamecode=gc, sessioncode="S2", bigblind="2")
        row2 = db.get_xml_by_gamecode(gc)
        self.assertEqual(row2["sessioncode"], "S2")
        self.assertEqual(row2["bigblind"], "2")

    def test_link_obs_to_game_idempotent(self):
        obs_id = db.insert_obs(fingerprint="obs_fp_link", table_id="mesa2")
        self.assertIsInstance(obs_id, int)

        db.upsert_xml_game(gamecode="G1", sessioncode="S")
        link1 = db.link_obs_to_game(obs_id=obs_id, gamecode="G1", match_score=0.9, match_method="manual")
        link2 = db.link_obs_to_game(obs_id=obs_id, gamecode="G1", match_score=0.1, match_method="other")
        self.assertEqual(link1, link2)


if __name__ == "__main__":
    unittest.main()
