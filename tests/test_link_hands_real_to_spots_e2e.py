import json
import os
import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PRE = ROOT / "modules" / "preflop"
if str(PRE) not in sys.path:
    sys.path.insert(0, str(PRE))

import link_hands_to_spots as sut
from link_spots_utils import parse_startdate_to_ms


def _create_db(db_path: Path):
    con = sqlite3.connect(str(db_path))
    cur = con.cursor()

    cur.execute(
        """
        CREATE TABLE hands (
            id INTEGER PRIMARY KEY,
            room TEXT NOT NULL,
            hero TEXT NOT NULL,
            tournament_path TEXT NOT NULL DEFAULT '',
            source_file TEXT NOT NULL,
            gamecode TEXT NOT NULL,
            startdate TEXT NOT NULL DEFAULT '',
            sb REAL NOT NULL DEFAULT 0,
            bb REAL NOT NULL DEFAULT 0,
            hero_cards TEXT NOT NULL DEFAULT '',
            flop TEXT NOT NULL DEFAULT '',
            turn TEXT NOT NULL DEFAULT '',
            river TEXT NOT NULL DEFAULT '',
            players_json TEXT NOT NULL DEFAULT '{}',
            created_at TEXT NOT NULL DEFAULT "datetime('now')",
            spot_png TEXT,
            spot_json TEXT
        )
        """
    )

    cur.execute(
        """
        INSERT INTO hands (
            id, room, hero, tournament_path, source_file, gamecode, startdate,
            sb, bb, hero_cards, flop, turn, river, players_json, spot_png, spot_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            85,
            "mesa 1",
            "xavieeee2",
            "",
            "test.xml",
            "12089117851",
            "2026-03-05 10:11:49",
            0.5,
            1.0,
            "HA CK",
            "",
            "",
            "",
            "{}",
            "",
            "",
        ),
    )

    cur.execute(
        """
        INSERT INTO hands (
            id, room, hero, tournament_path, source_file, gamecode, startdate,
            sb, bb, hero_cards, flop, turn, river, players_json, spot_png, spot_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            86,
            "mesa 2",
            "xavieeee2",
            "",
            "test.xml",
            "12089117852",
            "fecha_invalida",
            0.5,
            1.0,
            "HA CK",
            "",
            "",
            "",
            "{}",
            "",
            "",
        ),
    )

    con.commit()
    con.close()


def _create_spot(spots_dir: Path):
    spots_dir.mkdir(parents=True, exist_ok=True)

    png = spots_dir / "spot_match.png"
    png.write_bytes(b"fake-png-bytes")

    js = spots_dir / "spot_match.json"
    payload = {
        "spot_hash": "2233241e",
        "region": [520, 210, 776, 597],
        "saved_path": str(png),
        "ts_ms": parse_startdate_to_ms("2026-03-05 10:11:49"),
        "quality": {"mean": 240.2, "std": 31.2},
        "center_crop_ratio": 0.6,
        "stable_frames": 3,
        "stable_count": 3,
    }
    js.write_text(json.dumps(payload), encoding="utf-8")


def test_e2e_creates_gamecode_folder_and_updates_db(tmp_path, monkeypatch):
    db_path = tmp_path / "poker_boss.db"
    spots_dir = tmp_path / "spots_raw" / "time_spots" / "20260305"

    _create_db(db_path)
    _create_spot(spots_dir)

    monkeypatch.setattr(
        sys,
        "argv",
        [
            "link_hands_to_spots.py",
            "--db",
            str(db_path),
            "--spots_dir",
            str(spots_dir),
            "--window_ms",
            "60000",
            "--force",
        ],
    )

    rc = sut.main()
    assert rc == 0

    gamecode_dir = tmp_path / "hands_media" / "12089117851"
    assert gamecode_dir.exists()
    assert (gamecode_dir / "spot.png").exists()
    assert (gamecode_dir / "spot.json").exists()

    con = sqlite3.connect(str(db_path))
    cur = con.cursor()
    cur.execute("SELECT spot_png, spot_json FROM hands WHERE id = 85")
    row = cur.fetchone()
    con.close()

    assert row is not None
    spot_png, spot_json = row

    assert spot_png.endswith(os.path.join("hands_media", "12089117851", "spot.png"))
    assert spot_json.endswith(os.path.join("hands_media", "12089117851", "spot.json"))


def test_e2e_dry_run_no_modifica_db(tmp_path, monkeypatch):
    db_path = tmp_path / "poker_boss.db"
    spots_dir = tmp_path / "spots_raw" / "time_spots" / "20260305"

    _create_db(db_path)
    _create_spot(spots_dir)

    monkeypatch.setattr(
        sys,
        "argv",
        [
            "link_hands_to_spots.py",
            "--db",
            str(db_path),
            "--spots_dir",
            str(spots_dir),
            "--window_ms",
            "60000",
            "--force",
            "--dry_run",
        ],
    )

    rc = sut.main()
    assert rc == 0

    con = sqlite3.connect(str(db_path))
    cur = con.cursor()
    cur.execute("SELECT spot_png, spot_json FROM hands WHERE id = 85")
    row = cur.fetchone()
    con.close()

    assert row == ("", "")


def test_e2e_force_false_no_sobrescribe_si_ya_hay_spot(tmp_path, monkeypatch):
    db_path = tmp_path / "poker_boss.db"
    spots_dir = tmp_path / "spots_raw" / "time_spots" / "20260305"

    _create_db(db_path)
    _create_spot(spots_dir)

    con = sqlite3.connect(str(db_path))
    cur = con.cursor()
    cur.execute(
        "UPDATE hands SET spot_png=?, spot_json=? WHERE id=85",
        ("ya_existe.png", "ya_existe.json"),
    )
    con.commit()
    con.close()

    monkeypatch.setattr(
        sys,
        "argv",
        [
            "link_hands_to_spots.py",
            "--db",
            str(db_path),
            "--spots_dir",
            str(spots_dir),
            "--window_ms",
            "60000",
        ],
    )

    rc = sut.main()
    assert rc == 0

    con = sqlite3.connect(str(db_path))
    cur = con.cursor()
    cur.execute("SELECT spot_png, spot_json FROM hands WHERE id = 85")
    row = cur.fetchone()
    con.close()

    assert row == ("ya_existe.png", "ya_existe.json")
