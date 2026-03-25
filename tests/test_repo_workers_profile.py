from datetime import datetime

from modules.db.repo_workers_profile import insert_worker_profile
from modules.db.migrate import init_db
from tests.conftest import fetch_one


def test_insert_worker_profile_inserts_full_metrics(initialized_db):
    init_db()
    ts = datetime.utcnow().isoformat()

    metrics = {
        "time_gate": 0.1,
        "capture": 0.2,
        "fp_db": 0.3,
        "ocr": 0.4,
        "preflop": 0.5,
        "ocr_preflop_parallel": 0.6,
        "copy_capture": 0.7,
        "extract": 0.8,
        "insert_spot": 0.9,
        "strategy": 1.0,
        "obs": 1.1,
        "time_sec": 1.2,
        "total": 1.3,
    }

    insert_worker_profile(
        ts=ts,
        mesa=1,
        capture_id=10,
        spot_id=20,
        metrics=metrics,
    )

    row = fetch_one(
        initialized_db,
        "SELECT * FROM worker_profile WHERE ts = ? AND mesa = ?",
        (ts, 1),
    )

    assert row is not None
    assert row["mesa"] == 1
    assert row["capture_id"] == 10
    assert row["spot_id"] == 20
    assert row["time_gate"] == metrics["time_gate"]
    assert row["capture"] == metrics["capture"]
    assert row["fp_db"] == metrics["fp_db"]
    assert row["ocr"] == metrics["ocr"]
    assert row["preflop"] == metrics["preflop"]
    assert row["ocr_preflop_parallel"] == metrics["ocr_preflop_parallel"]
    assert row["copy_capture"] == metrics["copy_capture"]
    assert row["extract"] == metrics["extract"]
    assert row["insert_spot"] == metrics["insert_spot"]
    assert row["strategy"] == metrics["strategy"]
    assert row["obs"] == metrics["obs"]
    assert row["time_sec"] == metrics["time_sec"]
    assert row["total"] == metrics["total"]


def test_insert_worker_profile_missing_metrics_defaults_to_zero(initialized_db):
    init_db()
    ts = datetime.utcnow().isoformat()

    insert_worker_profile(
        ts=ts,
        mesa=2,
        capture_id=None,
        spot_id=None,
        metrics={},
    )

    row = fetch_one(
        initialized_db,
        "SELECT * FROM worker_profile WHERE ts = ? AND mesa = ?",
        (ts, 2),
    )

    assert row is not None
    # Cuando no hay métricas, todos los campos numéricos deben ser 0.0
    for key in [
        "time_gate",
        "capture",
        "fp_db",
        "ocr",
        "preflop",
        "ocr_preflop_parallel",
        "copy_capture",
        "extract",
        "insert_spot",
        "strategy",
        "obs",
        "time_sec",
        "total",
    ]:
        assert row[key] == 0.0

