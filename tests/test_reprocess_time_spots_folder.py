import sqlite3

from modules.db.migrate import init_db
from scripts.reprocess_time_spots_folder import _collect_rows_for_folder, _delete_rows_for_folder


def test_collect_and_delete_rows_only_for_requested_folder(temp_db_path):
    init_db()

    folder = r"C:\repo\data\spots_raw\time_spots\20260312"
    other_folder = r"C:\repo\data\spots_raw\time_spots\20260311"

    conn = sqlite3.connect(str(temp_db_path))
    conn.row_factory = sqlite3.Row
    try:
        conn.execute(
            """
            INSERT INTO hands_obs (fingerprint, frame_ref, created_at_ms)
            VALUES ('fp_target', ?, 1), ('fp_other', ?, 1)
            """,
            (folder + r"\a.png", other_folder + r"\b.png"),
        )
        target_obs_id = conn.execute("SELECT obs_id FROM hands_obs WHERE fingerprint='fp_target'").fetchone()[0]
        other_obs_id = conn.execute("SELECT obs_id FROM hands_obs WHERE fingerprint='fp_other'").fetchone()[0]

        conn.execute(
            """
            INSERT INTO hand_links (obs_id, gamecode, match_score, match_method, created_at_ms)
            VALUES (?, 'gc_target', 1.0, 'test', 1), (?, 'gc_other', 1.0, 'test', 1)
            """,
            (target_obs_id, other_obs_id),
        )
        conn.execute(
            """
            INSERT INTO workers_captures
            (mesa, image_path, final_image_path, image_fingerprint, image_size_bytes, status, reason, ocr_ok, ocr_json, created_at_ms, updated_at_ms)
            VALUES
            (0, ?, '', 'cap_target', 10, 'done', '', 1, '{}', 1, 1),
            (0, ?, '', 'cap_other', 10, 'done', '', 1, '{}', 1, 1)
            """,
            (folder + r"\a.png", other_folder + r"\b.png"),
        )
        conn.commit()

        rows = _collect_rows_for_folder(conn, folder)
        assert rows.obs_ids == [target_obs_id]
        assert len(rows.link_ids) == 1
        assert len(rows.capture_ids) == 1

        deleted = _delete_rows_for_folder(conn, rows)
        conn.commit()

        assert deleted == {
            "deleted_obs": 1,
            "deleted_links": 1,
            "deleted_workers_captures": 1,
        }

        remaining_obs = conn.execute("SELECT fingerprint FROM hands_obs ORDER BY obs_id").fetchall()
        assert [row["fingerprint"] for row in remaining_obs] == ["fp_other"]

        remaining_links = conn.execute("SELECT obs_id FROM hand_links").fetchall()
        assert [row["obs_id"] for row in remaining_links] == [other_obs_id]

        remaining_caps = conn.execute("SELECT image_fingerprint FROM workers_captures").fetchall()
        assert [row["image_fingerprint"] for row in remaining_caps] == ["cap_other"]
    finally:
        conn.close()
