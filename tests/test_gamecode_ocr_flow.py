import sqlite3
import sys

from modules.db.migrate import init_db
from modules.workers.worker_persist import persist_obs
import modules.preflop.link_hands_obs_to_real as linker


class _FakeDbMod:
    def __init__(self):
        self.calls = []

    def insert_obs(self, **kwargs):
        self.calls.append(kwargs)


def test_persist_obs_reenvia_captured_gamecode():
    fake_db = _FakeDbMod()

    persist_obs(
        fake_db,
        sig="obs-sig-1",
        ts=1710000000.0,
        mano_result={"mano_raw": "AhKh", "hand_class": "AKs"},
        preflop={"preflop_ok": True, "modules": {"noboard": {"noboard_ok": True}}},
        strategy={"se_used": 18},
        ocr_json="{}",
        bets_result={"p2": "0.5", "p3": "1.0"},
        gamecode_result={"ok": True, "value": "12345678901"},
        frame_ref="frame.png",
    )

    assert len(fake_db.calls) == 1
    assert fake_db.calls[0]["captured_gamecode"] == "12345678901"


def test_linker_crea_link_por_gamecode_ocr(temp_db_path, monkeypatch):
    init_db()

    con = sqlite3.connect(str(temp_db_path))
    try:
        cur = con.cursor()
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS hands (
                id INTEGER PRIMARY KEY,
                room TEXT NOT NULL DEFAULT '',
                hero TEXT NOT NULL DEFAULT '',
                tournament_path TEXT NOT NULL DEFAULT '',
                source_file TEXT NOT NULL DEFAULT '',
                gamecode TEXT NOT NULL,
                startdate TEXT NOT NULL DEFAULT '',
                sb REAL NOT NULL DEFAULT 0,
                bb REAL NOT NULL DEFAULT 0,
                hero_cards TEXT NOT NULL DEFAULT '',
                flop TEXT NOT NULL DEFAULT '',
                turn TEXT NOT NULL DEFAULT '',
                river TEXT NOT NULL DEFAULT '',
                players_json TEXT NOT NULL DEFAULT '{}',
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            )
            """
        )

        cur.execute(
            """
            INSERT INTO spots (
                fingerprint, table_id, detected_at_ms, mano_raw, hand_class, time_str,
                preflop_ok, noboard_ok, ocr_json, captured_gamecode, frame_ref, created_at_ms
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                "obs-gc-1",
                "mesa-1",
                1741262400000,
                "AhKh",
                "AKs",
                "10:00:00",
                1,
                1,
                "{}",
                "GC1",
                "frame.png",
                1741262400000,
            ),
        )

        cur.execute(
            """
            INSERT INTO hands (
                id, room, hero, tournament_path, source_file, gamecode, startdate,
                sb, bb, hero_cards, flop, turn, river, players_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                1,
                "room",
                "hero",
                "",
                "test.xml",
                "GC1",
                "2026-03-06 10:00:00",
                0.5,
                1.0,
                "HA HK",
                "",
                "",
                "",
                '{"players":[{"name":"hero","chips":20},{"name":"v1","chips":20},{"name":"v2","chips":20}]}',
            ),
        )
        con.commit()
    finally:
        con.close()

    monkeypatch.setattr(
        sys,
        "argv",
        ["link_hands_obs_to_real.py", "--db", str(temp_db_path)],
    )

    rc = linker.main()
    assert rc == 0

    con = sqlite3.connect(str(temp_db_path))
    try:
        row = con.execute(
            "SELECT obs_id, hand_id FROM spots WHERE hand_id IS NOT NULL"
        ).fetchone()
    finally:
        con.close()

    assert row is not None
    assert row[0] == 1  # obs_id
