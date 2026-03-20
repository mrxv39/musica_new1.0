from __future__ import annotations

import json
import sqlite3

from modules.db.migrate import init_db, now_ms
from modules.preflop import reprocess_no_strategy_obs as mod


def _payload_with_strategy_error(label: str) -> str:
    payload = {
        "mano": {"valid": True, "mano_raw": "AhKs", "hand_class": "AKo"},
        "stacks_preflop": {},
        "ocr": {
            "ok": True,
            "stackefectivo": {"ok": True, "value": 18.0},
            "bets": {"ok": True, "p1": 0.0, "p2": 0.5, "p3": 1.0},
            "stacks": {"ok": True, "p1": 20.0, "p2": 18.0, "p3": 22.0},
            "villano": {"ok": True, "p2": {"tipo": "FISH"}, "p3": {"tipo": "REG"}},
            "posiciones": {"ok": True, "p1": "BTN", "p2": "SB", "p3": "BB"},
        },
        "preflop": {"preflop_ok": True, "modules": {"noboard": {"noboard_ok": True}}},
        "strategy": {
            "ok": False,
            "error": f"ValueError: Expected exactly 1 match, got 0. matched_ids=[]. requested_situacion='{label}'.",
        },
        "tempo_s": 1.23,
    }
    return json.dumps(payload, ensure_ascii=False)


def _payload_with_other_error() -> str:
    payload = json.loads(_payload_with_strategy_error("OTHER"))
    payload["strategy"] = {"ok": False, "error": "missing_inputs_or_preflop_not_ok"}
    return json.dumps(payload, ensure_ascii=False)


def test_reprocess_updates_only_no_match_rows_and_keeps_links(monkeypatch, temp_db_path):
    init_db()

    conn = sqlite3.connect(str(temp_db_path))
    try:
        conn.execute(
            """
            INSERT INTO spots
            (spot_id, fingerprint, table_id, detected_at_ms, mano_raw, hand_class, time_str,
             preflop_ok, noboard_ok, ocr_json, p2bet, p3bet, p1_se_bb, captured_gamecode, frame_ref, created_at_ms)
            VALUES (?, ?, '', ?, 'AhKs', 'AKo', '', 1, 1, ?, 0.5, 1.0, NULL, 'GC1', 'frame1.bmp', ?)
            """,
            (1, "fp_match", now_ms(), _payload_with_strategy_error("BTN_vs_SB_BB_FISH_REG"), now_ms()),
        )
        conn.execute(
            """
            INSERT INTO spots
            (spot_id, fingerprint, table_id, detected_at_ms, mano_raw, hand_class, time_str,
             preflop_ok, noboard_ok, ocr_json, p2bet, p3bet, p1_se_bb, captured_gamecode, frame_ref, created_at_ms)
            VALUES (?, ?, '', ?, 'AhKs', 'AKo', '', 1, 1, ?, 0.5, 1.0, NULL, 'GC2', 'frame2.bmp', ?)
            """,
            (2, "fp_skip", now_ms(), _payload_with_other_error(), now_ms()),
        )
        conn.execute(
            """
            INSERT INTO workers_captures
            (capture_id, mesa, image_path, final_image_path, image_fingerprint, image_size_bytes, status, reason, ocr_ok, ocr_json, created_at_ms, updated_at_ms)
            VALUES (?, 1, 'img.bmp', '', ?, 10, 'captured', '', 1, ?, ?, ?)
            """,
            (10, "fp_match", _payload_with_strategy_error("BTN_vs_SB_BB_FISH_REG"), now_ms(), now_ms()),
        )
        conn.execute(
            """
            INSERT INTO hand_links (link_id, spot_id, gamecode, match_score, match_method, created_at_ms)
            VALUES (1, 1, 'GC1', 1.0, 'gamecode_ocr', ?)
            """,
            (now_ms(),),
        )
        conn.commit()
    finally:
        conn.close()

    def fake_compute_strategy_safe(preflop, mano_result, ocr):
        assert preflop["preflop_ok"] is True
        assert mano_result["hand_class"] == "AKo"
        assert ocr["posiciones"]["p1"] == "BTN"
        return (
            {
                "ok": True,
                "move": "RAISE",
                "betmin": 2.5,
                "betmax": 2.5,
                "se_used": 18.0,
                "requested_situacion": "BTN_vs_SB_BB_FISH_REG",
            },
            "",
        )

    monkeypatch.setattr(mod, "compute_strategy_safe", fake_compute_strategy_safe)
    monkeypatch.setattr(mod, "force_ok_on_default_fold", lambda strategy: strategy)

    stats = mod.reprocess_no_strategy_obs(db_path=str(temp_db_path))

    assert stats["selected"] == 1
    assert stats["updated"] == 1
    assert stats["updated_ok"] == 1
    assert stats["updated_still_not_ok"] == 0
    assert stats["workers_captures_synced"] == 1
    assert stats["obs_ids"] == [1]

    conn = sqlite3.connect(str(temp_db_path))
    conn.row_factory = sqlite3.Row
    try:
        row1 = conn.execute("SELECT ocr_json, p1_se_bb FROM spots WHERE spot_id = 1").fetchone()
        payload1 = json.loads(row1["ocr_json"])
        assert payload1["strategy"]["ok"] is True
        assert payload1["strategy"]["move"] == "RAISE"
        assert row1["p1_se_bb"] == 18.0

        row2 = conn.execute("SELECT ocr_json FROM spots WHERE spot_id = 2").fetchone()
        payload2 = json.loads(row2["ocr_json"])
        assert payload2["strategy"]["error"] == "missing_inputs_or_preflop_not_ok"

        wc = conn.execute("SELECT ocr_json FROM workers_captures WHERE capture_id = 10").fetchone()
        wc_payload = json.loads(wc["ocr_json"])
        assert wc_payload["strategy"]["move"] == "RAISE"

        link = conn.execute("SELECT gamecode, match_method FROM hand_links WHERE spot_id = 1").fetchone()
        assert tuple(link) == ("GC1", "gamecode_ocr")
    finally:
        conn.close()


def test_reprocess_respects_limit(monkeypatch, temp_db_path):
    init_db()

    conn = sqlite3.connect(str(temp_db_path))
    try:
        conn.execute(
            """
            INSERT INTO spots
            (spot_id, fingerprint, table_id, detected_at_ms, mano_raw, hand_class, time_str,
             preflop_ok, noboard_ok, ocr_json, created_at_ms)
            VALUES (1, 'fp1', '', 1000, 'AhKs', 'AKo', '', 1, 1, ?, ?)
            """,
            (_payload_with_strategy_error("S1"), now_ms()),
        )
        conn.execute(
            """
            INSERT INTO spots
            (spot_id, fingerprint, table_id, detected_at_ms, mano_raw, hand_class, time_str,
             preflop_ok, noboard_ok, ocr_json, created_at_ms)
            VALUES (2, 'fp2', '', 2000, 'AhKs', 'AKo', '', 1, 1, ?, ?)
            """,
            (_payload_with_strategy_error("S2"), now_ms()),
        )
        conn.commit()
    finally:
        conn.close()

    calls = {"count": 0}

    def fake_compute_strategy_safe(*_args, **_kwargs):
        calls["count"] += 1
        return ({"ok": False, "error": "ValueError: Expected exactly 1 match, got 0.", "se_used": 11.0}, "")

    monkeypatch.setattr(mod, "compute_strategy_safe", fake_compute_strategy_safe)
    monkeypatch.setattr(mod, "force_ok_on_default_fold", lambda strategy: strategy)

    stats = mod.reprocess_no_strategy_obs(db_path=str(temp_db_path), limit=1)

    assert stats["selected"] == 1
    assert stats["updated"] == 1
    assert len(stats["obs_ids"]) == 1
    assert calls["count"] == 1
