import sqlite3

from modules.preflop.link_hands_obs_to_real import link_hands_obs_to_real


def _create_hands_real_table(conn):
    conn.execute(
        """
        CREATE TABLE hands_real (
            id INTEGER PRIMARY KEY,
            gamecode TEXT NOT NULL,
            hero_cards TEXT NOT NULL DEFAULT '',
            startdate TEXT NOT NULL DEFAULT '',
            hero TEXT NOT NULL DEFAULT '',
            bb REAL NOT NULL DEFAULT 0,
            players_json TEXT NOT NULL DEFAULT '{}'
        )
        """
    )


def _insert_obs(
    conn,
    *,
    fingerprint,
    mano_raw,
    captured_gamecode="",
    ocr_json="{}",
    detected_at_ms=1741262400000,
):
    cur = conn.execute(
        """
        INSERT INTO hands_obs (
            fingerprint, table_id, detected_at_ms, mano_raw, hand_class, time_str,
            preflop_ok, noboard_ok, ocr_json, captured_gamecode, frame_ref, created_at_ms
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            fingerprint,
            "mesa-1",
            detected_at_ms,
            mano_raw,
            "",
            "10:00:00",
            1,
            1,
            ocr_json,
            captured_gamecode,
            "frame.png",
            detected_at_ms,
        ),
    )
    return cur.lastrowid


def _insert_real(conn, *, hand_id, gamecode, hero_cards, startdate="2026-03-06 10:00:00"):
    conn.execute(
        """
        INSERT INTO hands_real (id, gamecode, hero_cards, startdate, hero, bb, players_json)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (
            hand_id,
            gamecode,
            hero_cards,
            startdate,
            "hero",
            1.0,
            '{"players":[{"name":"hero","chips":20},{"name":"v1","chips":20},{"name":"v2","chips":20}]}',
        ),
    )


def test_link_hands_obs_to_real_links_by_gamecode_ocr(initialized_db, temp_db_path):
    conn = sqlite3.connect(str(temp_db_path))
    try:
        _create_hands_real_table(conn)
        obs_id = _insert_obs(conn, fingerprint="obs-gc-1", mano_raw="AhKh", captured_gamecode="GC1")
        _insert_real(conn, hand_id=1, gamecode="GC1", hero_cards="HA HK")
        conn.commit()
    finally:
        conn.close()

    result = link_hands_obs_to_real(db_path=str(temp_db_path), obs_ids=None)

    assert result["links_created"] == 1

    conn = sqlite3.connect(str(temp_db_path))
    try:
        row = conn.execute(
            "SELECT obs_id, gamecode, match_method FROM hand_links"
        ).fetchone()
    finally:
        conn.close()

    assert row == (obs_id, "GC1", "gamecode_ocr")


def test_link_hands_obs_to_real_links_by_rank_only(initialized_db, temp_db_path):
    conn = sqlite3.connect(str(temp_db_path))
    try:
        _create_hands_real_table(conn)
        obs_id = _insert_obs(conn, fingerprint="obs-rank-1", mano_raw="9c8h", captured_gamecode="")
        _insert_real(conn, hand_id=1, gamecode="GC9", hero_cards="9s 8h")
        conn.commit()
    finally:
        conn.close()

    result = link_hands_obs_to_real(db_path=str(temp_db_path), obs_ids=None)

    assert result["links_created"] == 1

    conn = sqlite3.connect(str(temp_db_path))
    try:
        row = conn.execute(
            "SELECT obs_id, gamecode, match_method FROM hand_links"
        ).fetchone()
    finally:
        conn.close()

    assert row == (obs_id, "GC9", "rank_only")


def test_link_hands_obs_to_real_uses_each_gamecode_only_once(initialized_db, temp_db_path):
    conn = sqlite3.connect(str(temp_db_path))
    try:
        _create_hands_real_table(conn)
        _insert_obs(conn, fingerprint="obs-gc-1", mano_raw="AhKh", captured_gamecode="GC1")
        _insert_obs(conn, fingerprint="obs-gc-2", mano_raw="AdKd", captured_gamecode="GC1")
        _insert_real(conn, hand_id=1, gamecode="GC1", hero_cards="HA HK")
        conn.commit()
    finally:
        conn.close()

    result = link_hands_obs_to_real(db_path=str(temp_db_path), obs_ids=None)

    assert result["links_created"] == 1

    conn = sqlite3.connect(str(temp_db_path))
    try:
        count = conn.execute("SELECT COUNT(*) FROM hand_links").fetchone()[0]
    finally:
        conn.close()

    assert count == 1
