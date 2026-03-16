from __future__ import annotations

from typing import Any, Dict, Optional

from .conn import connect
from .migrate import init_db


def insert_worker_profile(
    *,
    ts: str,
    mesa: int,
    capture_id: Optional[int],
    spot_id: Optional[int],
    metrics: Dict[str, float],
) -> None:
    """
    Guarda tiempos de perfilado de un spot en la tabla worker_profile.
    Se asume que solo se llama cuando el perfilado está activado.
    """
    init_db()
    with connect() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO worker_profile (
                ts,
                mesa,
                capture_id,
                spot_id,
                time_gate,
                capture,
                fp_db,
                ocr,
                preflop,
                ocr_preflop_parallel,
                copy_capture,
                extract,
                insert_spot,
                strategy,
                obs,
                time_sec,
                total
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                ts,
                int(mesa),
                capture_id,
                spot_id,
                float(metrics.get("time_gate", 0.0)),
                float(metrics.get("capture", 0.0)),
                float(metrics.get("fp_db", 0.0)),
                float(metrics.get("ocr", 0.0)),
                float(metrics.get("preflop", 0.0)),
                float(metrics.get("ocr_preflop_parallel", 0.0)),
                float(metrics.get("copy_capture", 0.0)),
                float(metrics.get("extract", 0.0)),
                float(metrics.get("insert_spot", 0.0)),
                float(metrics.get("strategy", 0.0)),
                float(metrics.get("obs", 0.0)),
                float(metrics.get("time_sec", 0.0)),
                float(metrics.get("total", 0.0)),
            ),
        )
        conn.commit()

