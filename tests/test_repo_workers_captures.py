import json
import sqlite3

from modules.db.repo_workers_captures import (
    find_recent_capture_by_fingerprint,
    insert_worker_capture,
    update_worker_capture_ocr,
    update_worker_capture_route,
)
from modules.db.migrate import init_db


def test_insert_worker_capture_inserta_fila_base(temp_db_path):
    init_db()

    capture_id = insert_worker_capture(
        mesa=2,
        image_path=r"C:\tmp\cap.bmp",
        image_fingerprint="fp_001",
        image_size_bytes=12345,
        status="captured",
        reason="",
    )

    assert capture_id is not None

    conn = sqlite3.connect(str(temp_db_path))
    conn.row_factory = sqlite3.Row
    try:
        row = conn.execute(
            "SELECT * FROM workers_captures WHERE capture_id=?",
            (capture_id,),
        ).fetchone()
        assert row is not None
        assert row["mesa"] == 2
        assert row["image_path"] == r"C:\tmp\cap.bmp"
        assert row["image_fingerprint"] == "fp_001"
        assert row["image_size_bytes"] == 12345
        assert row["status"] == "captured"
        assert row["ocr_ok"] == 0
        assert row["ocr_json"] == ""
        assert row["created_at_ms"] > 0
        assert row["updated_at_ms"] > 0
    finally:
        conn.close()


def test_find_recent_capture_by_fingerprint_devuelve_la_mas_reciente(temp_db_path):
    init_db()

    c1 = insert_worker_capture(
        mesa=1,
        image_path="a.bmp",
        image_fingerprint="same_fp",
        image_size_bytes=1,
        status="captured",
    )
    c2 = insert_worker_capture(
        mesa=1,
        image_path="b.bmp",
        image_fingerprint="same_fp",
        image_size_bytes=1,
        status="captured",
    )

    conn = sqlite3.connect(str(temp_db_path))
    try:
        conn.execute(
            "UPDATE workers_captures SET created_at_ms=?, updated_at_ms=? WHERE capture_id=?",
            (1000, 1000, c1),
        )
        conn.execute(
            "UPDATE workers_captures SET created_at_ms=?, updated_at_ms=? WHERE capture_id=?",
            (2000, 2000, c2),
        )
        conn.commit()
    finally:
        conn.close()

    row = find_recent_capture_by_fingerprint(
        image_fingerprint="same_fp",
        since_ms=1500,
    )
    assert row is not None
    assert row["capture_id"] == c2
    assert row["image_path"] == "b.bmp"


def test_find_recent_capture_by_fingerprint_fuera_de_ventana_devuelve_none(temp_db_path):
    init_db()

    c1 = insert_worker_capture(
        mesa=1,
        image_path="a.bmp",
        image_fingerprint="old_fp",
        image_size_bytes=1,
        status="captured",
    )

    conn = sqlite3.connect(str(temp_db_path))
    try:
        conn.execute(
            "UPDATE workers_captures SET created_at_ms=?, updated_at_ms=? WHERE capture_id=?",
            (1000, 1000, c1),
        )
        conn.commit()
    finally:
        conn.close()

    row = find_recent_capture_by_fingerprint(
        image_fingerprint="old_fp",
        since_ms=999999,
    )
    assert row is None


def test_update_worker_capture_ocr_guarda_json_y_columnas_planas(temp_db_path, sample_ocr_payload):
    init_db()

    capture_id = insert_worker_capture(
        mesa=3,
        image_path="ocr.bmp",
        image_fingerprint="fp_ocr",
        image_size_bytes=10,
        status="captured",
    )

    ok = update_worker_capture_ocr(
        capture_id=capture_id,
        ocr_ok=True,
        ocr_json=json.dumps(sample_ocr_payload, ensure_ascii=False),
    )
    assert ok is True

    conn = sqlite3.connect(str(temp_db_path))
    conn.row_factory = sqlite3.Row
    try:
        row = conn.execute(
            "SELECT * FROM workers_captures WHERE capture_id=?",
            (capture_id,),
        ).fetchone()
        assert row is not None
        assert row["ocr_ok"] == 1
        assert row["names_ok"] == 1
        assert row["p2_name"] == "VillanoA"
        assert row["p3_name"] == "VillanoB"
        assert row["villano_ok"] == 1
        assert row["villano_p2_tipo"] == "fish"
        assert row["villano_p3_tipo"] == "reg"
        assert row["stackefectivo_ok"] == 1
        assert row["stackefectivo_value"] == 15.0
        assert row["bets_ok"] == 1
        assert row["bet_p1"] == 0.0
        assert row["bet_p2"] == 0.5
        assert row["bet_p3"] == 1.0
        assert row["stacks_ok"] == 1
        assert row["stack_p1"] == 15.0
        assert row["stack_p2"] == 20.0
        assert row["stack_p3"] == 18.0
        assert row["table_state_ok"] == 1
        assert row["table_players"] == 3
        assert row["table_is_hu"] == 0
        assert row["table_is_3h"] == 1
        assert row["dealer_ok"] == 1
        assert row["dealer_seat"] == "p1"
        assert row["dealer_score"] == 0.93
        assert row["posiciones_ok"] == 1
        assert row["pos_p1"] == "BTN"
        assert row["pos_p2"] == "SB"
        assert row["pos_p3"] == "BB"
        assert row["pos_btn_seat"] == "p1"
        assert row["pos_sb_seat"] == "p2"
        assert row["pos_bb_seat"] == "p3"
    finally:
        conn.close()


def test_update_worker_capture_ocr_con_json_invalido_no_rompe(temp_db_path):
    init_db()

    capture_id = insert_worker_capture(
        mesa=1,
        image_path="bad.bmp",
        image_fingerprint="fp_bad_json",
        image_size_bytes=10,
        status="captured",
    )

    ok = update_worker_capture_ocr(
        capture_id=capture_id,
        ocr_ok=True,
        ocr_json="{json_invalido",
    )
    assert ok is True

    conn = sqlite3.connect(str(temp_db_path))
    conn.row_factory = sqlite3.Row
    try:
        row = conn.execute(
            "SELECT * FROM workers_captures WHERE capture_id=?",
            (capture_id,),
        ).fetchone()
        assert row["ocr_ok"] == 1
        assert row["ocr_json"] == "{json_invalido"
        assert row["names_ok"] == 0
        assert row["p2_name"] == ""
        assert row["stackefectivo_value"] is None
        assert row["dealer_seat"] == ""
    finally:
        conn.close()


def test_update_worker_capture_route_actualiza_estado_final(temp_db_path):
    init_db()

    capture_id = insert_worker_capture(
        mesa=4,
        image_path="route.bmp",
        image_fingerprint="fp_route",
        image_size_bytes=10,
        status="captured",
    )

    ok = update_worker_capture_route(
        capture_id=capture_id,
        final_image_path=r"C:\dest\route.bmp",
        status="processed",
        reason="ok",
    )
    assert ok is True

    conn = sqlite3.connect(str(temp_db_path))
    conn.row_factory = sqlite3.Row
    try:
        row = conn.execute(
            "SELECT * FROM workers_captures WHERE capture_id=?",
            (capture_id,),
        ).fetchone()
        assert row["final_image_path"] == r"C:\dest\route.bmp"
        assert row["status"] == "processed"
        assert row["reason"] == "ok"
    finally:
        conn.close()
