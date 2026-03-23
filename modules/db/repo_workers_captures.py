from __future__ import annotations

from typing import Any, Dict, Optional

from .conn import connect
from .migrate import init_db, now_ms
from .repo_workers_captures_flatten import flatten_ocr
from .repo_workers_captures_params import build_worker_capture_ocr_params
from .repo_workers_captures_sql import UPDATE_WORKER_CAPTURE_OCR_SQL
from .repo_workers_captures_utils import parse_ocr_json


def find_recent_capture_by_fingerprint(
    *,
    image_fingerprint: str,
    since_ms: int,
) -> Optional[Dict[str, Any]]:
    init_db()
    with connect() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT *
            FROM workers_captures
            WHERE image_fingerprint = ?
              AND created_at_ms >= ?
            ORDER BY created_at_ms DESC, capture_id DESC
            LIMIT 1
            """,
            (image_fingerprint, int(since_ms)),
        )
        row = cur.fetchone()
        return dict(row) if row else None


def insert_worker_capture(
    *,
    mesa: int,
    image_path: str,
    image_fingerprint: str,
    image_size_bytes: int,
    status: str,
    reason: str = "",
) -> Optional[int]:
    init_db()
    now = now_ms()
    with connect() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO workers_captures
            (
                mesa,
                image_path,
                final_image_path,
                image_fingerprint,
                image_size_bytes,
                status,
                reason,
                ocr_ok,
                ocr_json,
                created_at_ms,
                updated_at_ms
            )
            VALUES (?, ?, '', ?, ?, ?, ?, 0, '', ?, ?)
            """,
            (
                int(mesa),
                image_path or "",
                image_fingerprint or "",
                int(image_size_bytes or 0),
                status or "",
                reason or "",
                now,
                now,
            ),
        )
        conn.commit()
        return int(cur.lastrowid) if cur.lastrowid else None


def update_worker_capture_ocr(
    *,
    capture_id: int,
    ocr_ok: bool,
    ocr_json: str,
) -> bool:
    init_db()

    ocr = parse_ocr_json(ocr_json)
    flat = flatten_ocr(ocr)
    params = build_worker_capture_ocr_params(
        capture_id=capture_id,
        ocr_ok=ocr_ok,
        ocr_json=ocr_json,
        flat=flat,
    )

    with connect() as conn:
        cur = conn.cursor()
        cur.execute(UPDATE_WORKER_CAPTURE_OCR_SQL, params)
        conn.commit()
        return cur.rowcount > 0


def update_worker_capture_route(
    *,
    capture_id: int,
    final_image_path: str,
    status: str,
    reason: str = "",
) -> bool:
    init_db()
    with connect() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            UPDATE workers_captures
            SET final_image_path = ?,
                status = ?,
                reason = ?,
                updated_at_ms = ?
            WHERE capture_id = ?
            """,
            (
                final_image_path or "",
                status or "",
                reason or "",
                now_ms(),
                int(capture_id),
            ),
        )
        conn.commit()
        return cur.rowcount > 0
