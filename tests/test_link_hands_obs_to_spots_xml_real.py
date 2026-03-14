import json
import sqlite3

from modules.preflop.link_hands_obs_to_spots_xml_real import ensure_schema, link_obs_to_spots


def test_link_obs_to_spots_links_two_preflop_spots_for_one_hand(temp_db_path):
    conn = sqlite3.connect(str(temp_db_path))
    try:
        conn.executescript(
            """
            CREATE TABLE hands_real (
                id INTEGER PRIMARY KEY,
                gamecode TEXT NOT NULL
            );

            CREATE TABLE spots_xml_real (
                spot_id INTEGER PRIMARY KEY,
                hand_id INTEGER NOT NULL,
                gamecode TEXT NOT NULL,
                hero_name TEXT,
                street TEXT NOT NULL,
                spot_index INTEGER NOT NULL,
                action_index INTEGER NOT NULL,
                hero_cards TEXT,
                players_count INTEGER,
                spot_kind TEXT
            );

            CREATE TABLE hands_obs (
                obs_id INTEGER PRIMARY KEY,
                table_id TEXT,
                detected_at_ms INTEGER,
                mano_raw TEXT,
                hand_class TEXT,
                preflop_ok INTEGER,
                ocr_json TEXT,
                p2bet REAL,
                p3bet REAL,
                frame_ref TEXT
            );
            """
        )
        ensure_schema(conn)

        conn.execute(
            "INSERT INTO hands_real(id, gamecode) VALUES (?, ?)",
            (77, "G-77"),
        )
        conn.executemany(
            """
            INSERT INTO spots_xml_real(
                spot_id, hand_id, gamecode, hero_name, street, spot_index,
                action_index, hero_cards, players_count, spot_kind
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                (701, 77, "G-77", "Hero", "preflop", 1, 1, "HK DQ", 3, "open"),
                (702, 77, "G-77", "Hero", "preflop", 2, 2, "HK DQ", 3, "call"),
            ],
        )

        ocr_payload = json.dumps({"ocr": {"table_state": {"players": 3}}})
        conn.executemany(
            """
            INSERT INTO hands_obs(
                obs_id, table_id, detected_at_ms, mano_raw, hand_class,
                preflop_ok, ocr_json, p2bet, p3bet, frame_ref
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                (901, "mesa_1", 1000, "KhQd", "KQo", 1, ocr_payload, 0.5, 1.0, "frame_1.bmp"),
                (902, "mesa_1", 2000, "KhQd", "KQo", 1, ocr_payload, 0.5, 1.0, "frame_2.bmp"),
            ],
        )
        conn.commit()
    finally:
        conn.close()

    result = link_obs_to_spots(db_path=str(temp_db_path), verbose=False)

    assert result["linked"] == 2

    conn = sqlite3.connect(str(temp_db_path))
    try:
        rows = conn.execute(
            "SELECT obs_id, spot_id FROM spot_links ORDER BY spot_id ASC, obs_id ASC"
        ).fetchall()
    finally:
        conn.close()

    assert len(rows) == 2
    assert {row[0] for row in rows} == {901, 902}
    assert {row[1] for row in rows} == {701, 702}
