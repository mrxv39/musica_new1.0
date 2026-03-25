# tests/test_db_repos.py
"""Tests for DB repository modules: repo_obs, repo_xml, repo_legacy."""
import json
import unittest

from modules.db import db

# Skip marker for tests affected by DB schema refactor (hands_xml table removed)
SKIP_XML_REASON = "hands_xml table was removed in DB refactor; use hands table instead via tournaments/hands API"

# Skip marker for legacy hand tests
SKIP_LEGACY_REASON = "hands table schema was refactored; fingerprint column no longer exists; use hands.gamecode and tournaments API instead"


class TestRepoObs(unittest.TestCase):
    def setUp(self):
        db.init_db()

    def test_insert_and_retrieve_obs(self):
        fp = "obs_test_001"
        obs_id = db.insert_obs(
            fingerprint=fp,
            table_id="mesa1",
            detected_at_ms=5000,
            mano_raw="AhKd",
            hand_class="AKo",
            time_str="15:30:00",
            preflop_ok=True,
            noboard_ok=True,
            ocr_json=json.dumps({"stacks": {"p1": 25}}),
            frame_ref="frame_001.bmp",
        )
        self.assertIsInstance(obs_id, int)

        row = db.get_obs_by_fingerprint(fp)
        self.assertIsNotNone(row)
        self.assertEqual(row["table_id"], "mesa1")
        self.assertEqual(row["hand_class"], "AKo")
        self.assertEqual(row["preflop_ok"], 1)
        self.assertEqual(row["noboard_ok"], 1)
        self.assertEqual(row["frame_ref"], "frame_001.bmp")

    def test_insert_obs_with_bets(self):
        fp = "obs_bets_001"
        obs_id = db.insert_obs(
            fingerprint=fp,
            p2bet=2.5,
            p3bet=5.0,
        )
        self.assertIsInstance(obs_id, int)
        row = db.get_obs_by_fingerprint(fp)
        self.assertAlmostEqual(row["p2bet"], 2.5)
        self.assertAlmostEqual(row["p3bet"], 5.0)

    def test_insert_obs_none_bets_stored_as_null(self):
        fp = "obs_null_bets"
        db.insert_obs(fingerprint=fp)
        row = db.get_obs_by_fingerprint(fp)
        self.assertIsNone(row["p2bet"])
        self.assertIsNone(row["p3bet"])

    def test_get_nonexistent_obs_returns_none(self):
        row = db.get_obs_by_fingerprint("does_not_exist")
        self.assertIsNone(row)


@unittest.skip(SKIP_XML_REASON)
class TestRepoXml(unittest.TestCase):
    def setUp(self):
        db.init_db()

    def test_upsert_and_retrieve(self):
        gc = "GAME_001"
        result = db.upsert_xml_game(
            gamecode=gc,
            sessioncode="SESSION1",
            startdate="2026-03-25 10:00:00",
            smallblind="0.5",
            bigblind="1.0",
            hero_name="player1",
        )
        self.assertEqual(result, gc)

        row = db.get_xml_by_gamecode(gc)
        self.assertIsNotNone(row)
        self.assertEqual(row["sessioncode"], "SESSION1")
        self.assertEqual(row["bigblind"], "1.0")

    def test_upsert_updates_existing(self):
        gc = "GAME_UPDATE"
        db.upsert_xml_game(gamecode=gc, sessioncode="S1", bigblind="1")
        db.upsert_xml_game(gamecode=gc, sessioncode="S2", bigblind="2")

        row = db.get_xml_by_gamecode(gc)
        self.assertEqual(row["sessioncode"], "S2")
        self.assertEqual(row["bigblind"], "2")

    def test_upsert_empty_gamecode_returns_none(self):
        result = db.upsert_xml_game(gamecode="")
        self.assertIsNone(result)

    def test_get_nonexistent_xml_returns_none(self):
        row = db.get_xml_by_gamecode("NOPE")
        self.assertIsNone(row)


@unittest.skip(SKIP_LEGACY_REASON)
class TestRepoLegacy(unittest.TestCase):
    def setUp(self):
        db.init_db()

    def test_insert_and_retrieve_hand(self):
        fp = "legacy_fp_001"
        data = json.dumps({"test": True})
        hand_id = db.insert_hand(fp, data)
        self.assertIsInstance(hand_id, int)

        row = db.get_hand_by_fingerprint(fp)
        self.assertIsNotNone(row)
        self.assertEqual(row["fingerprint"], fp)
        loaded = json.loads(row["data_json"])
        self.assertTrue(loaded["test"])

    def test_insert_hand_idempotent(self):
        fp = "legacy_fp_idem"
        id1 = db.insert_hand(fp, "{}")
        id2 = db.insert_hand(fp, "{}")
        self.assertEqual(id1, id2)

    def test_get_nonexistent_hand_returns_none(self):
        row = db.get_hand_by_fingerprint("nope_legacy")
        self.assertIsNone(row)


@unittest.skip(SKIP_XML_REASON)
class TestLinkObsToGame(unittest.TestCase):
    def setUp(self):
        db.init_db()

    def test_link_and_retrieve(self):
        obs_id = db.insert_obs(fingerprint="link_obs_1")
        db.upsert_xml_game(gamecode="LINK_G1", sessioncode="S")
        link_id = db.link_obs_to_game(obs_id=obs_id, gamecode="LINK_G1", match_score=0.95, match_method="auto")
        self.assertIsInstance(link_id, int)

    def test_link_idempotent(self):
        obs_id = db.insert_obs(fingerprint="link_obs_2")
        db.upsert_xml_game(gamecode="LINK_G2")
        link1 = db.link_obs_to_game(obs_id=obs_id, gamecode="LINK_G2")
        link2 = db.link_obs_to_game(obs_id=obs_id, gamecode="LINK_G2")
        self.assertEqual(link1, link2)

    def test_link_empty_gamecode_returns_none(self):
        result = db.link_obs_to_game(obs_id=1, gamecode="")
        self.assertIsNone(result)

    def test_link_zero_obs_id_returns_none(self):
        result = db.link_obs_to_game(obs_id=0, gamecode="G1")
        self.assertIsNone(result)


if __name__ == "__main__":
    unittest.main()
