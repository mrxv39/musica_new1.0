import json
import os
import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PRE = ROOT / "modules" / "preflop"
if str(PRE) not in sys.path:
    sys.path.insert(0, str(PRE))

from link_spots_utils import (
    REGION_BY_ROOM,
    build_spots_by_region,
    copy_spot_to_hand_media,
    load_spots,
    norm_room,
    parse_startdate_to_ms,
    sanitize_folder_name,
)


def test_norm_room_normaliza_variantes():
    assert norm_room("mesa 1") == "1"
    assert norm_room("Table 2") == "2"
    assert norm_room("#3") == "3"
    assert norm_room("  004 ") == "4"
    assert norm_room(None) == ""
    assert norm_room("championpoker") == ""


def test_parse_startdate_to_ms_acepta_formatos_comunes():
    a = parse_startdate_to_ms("2026-03-05 10:11:49")
    b = parse_startdate_to_ms("2026/03/05 10:11:49")
    c = parse_startdate_to_ms("2026-03-05T10:11:49")
    d = parse_startdate_to_ms("2026-03-05T10:11:49Z")

    assert isinstance(a, int)
    assert isinstance(b, int)
    assert isinstance(c, int)
    assert isinstance(d, int)


def test_parse_startdate_to_ms_timestamp_segundos_y_milisegundos():
    assert parse_startdate_to_ms("1772701910") == 1772701910000
    assert parse_startdate_to_ms("1772701910160") == 1772701910160


def test_parse_startdate_to_ms_invalido_devuelve_none():
    assert parse_startdate_to_ms(None) is None
    assert parse_startdate_to_ms("") is None
    assert parse_startdate_to_ms("fecha_rara") is None


def test_load_spots_carga_y_ordena(tmp_path):
    p1 = tmp_path / "spot_a.json"
    p2 = tmp_path / "spot_b.json"

    p1.write_text(
        json.dumps({
            "ts_ms": 2000,
            "saved_path": "img_b.png",
            "region": [520, 807, 776, 597],
            "spot_hash": "bbb",
        }),
        encoding="utf-8",
    )
    p2.write_text(
        json.dumps({
            "ts_ms": 1000,
            "saved_path": "img_a.png",
            "region": [520, 210, 776, 597],
            "spot_hash": "aaa",
        }),
        encoding="utf-8",
    )

    spots = load_spots(str(tmp_path))

    assert len(spots) == 2
    assert spots[0]["ts_ms"] == 1000
    assert spots[1]["ts_ms"] == 2000
    assert spots[0]["region"] == (520, 210, 776, 597)


def test_load_spots_ignora_json_invalidos_o_incompletos(tmp_path):
    (tmp_path / "spot_bad1.json").write_text("{}", encoding="utf-8")
    (tmp_path / "spot_bad2.json").write_text(json.dumps({"ts_ms": "x", "saved_path": "a.png"}), encoding="utf-8")
    (tmp_path / "spot_bad3.json").write_text(json.dumps({"ts_ms": 1000}), encoding="utf-8")

    spots = load_spots(str(tmp_path))
    assert spots == []


def test_build_spots_by_region_agrupa_correctamente():
    r1 = REGION_BY_ROOM["1"]
    r2 = REGION_BY_ROOM["2"]

    spots = [
        {"ts_ms": 1000, "region": r1},
        {"ts_ms": 2000, "region": r1},
        {"ts_ms": 3000, "region": r2},
        {"ts_ms": 4000, "region": None},
    ]

    out = build_spots_by_region(spots)

    assert list(out.keys()) == [r1, r2]
    assert len(out[r1]) == 2
    assert len(out[r2]) == 1


def test_sanitize_folder_name_limpia_caracteres():
    assert sanitize_folder_name("12089117851") == "12089117851"
    assert sanitize_folder_name("abc<>:/\\|?*xyz") == "abc_xyz"
    assert sanitize_folder_name("  hola mundo  ") == "hola_mundo"
    assert sanitize_folder_name("") == "unknown_gamecode"


def test_copy_spot_to_hand_media_copia_png_y_json(tmp_path):
    db_path = tmp_path / "poker_boss.db"
    db_path.write_text("", encoding="utf-8")

    src_png = tmp_path / "a.png"
    src_json = tmp_path / "a.json"
    src_png.write_bytes(b"png")
    src_json.write_text('{"ok":true}', encoding="utf-8")

    dst_png, dst_json = copy_spot_to_hand_media(
        str(db_path),
        "game:123",
        str(src_png),
        str(src_json),
    )

    assert os.path.exists(dst_png)
    assert os.path.exists(dst_json)
    assert dst_png.endswith(os.path.join("hands_real_media", "game_123", "spot.png"))
    assert dst_json.endswith(os.path.join("hands_real_media", "game_123", "spot.json"))
