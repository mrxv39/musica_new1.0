from datetime import datetime

from modules.db.migrate import init_db
from modules.db.repo_spots_capture import insert_spot_capture_from_data
from tests.conftest import fetch_one


def test_insert_spot_capture_from_data_persists_time_sec(initialized_db):
    init_db()
    ts = datetime.utcnow().isoformat(sep=" ", timespec="seconds")

    spot_id = insert_spot_capture_from_data(
        mesa=1,
        image_path="C:/tmp/spot1.png",
        ts=ts,
        stacks_result={"p1": 10, "p2": 20, "p3": 30},
        ocr={
            "bets": {"p1": 0.0, "p2": 0.5, "p3": 1.0},
            "names": {
                "p1_name": "Hero",
                "p2_name": "VillanoA",
                "p3_name": "VillanoB",
            },
            "villano": {
                "p2": {"tipo": "fish"},
                "p3": {"tipo": "reg"},
            },
        },
        preflop={"some": "value"},
        mano_result={"mano": "AH KH"},
        time_sec=3.25,
    )

    assert spot_id is not None

    row = fetch_one(
        initialized_db,
        "SELECT * FROM spots WHERE id = ?",
        (spot_id,),
    )

    assert row is not None
    assert row["mesa"] == 1
    assert row["image_path"] == "C:/tmp/spot1.png"
    # La columna time debe reflejar el valor pasado en time_sec
    assert abs(row["time"] - 3.25) < 1e-6


def test_insert_spot_capture_from_data_with_time_none_stores_null(initialized_db):
    init_db()
    ts = datetime.utcnow().isoformat(sep=" ", timespec="seconds")

    spot_id = insert_spot_capture_from_data(
        mesa=2,
        image_path="C:/tmp/spot2.png",
        ts=ts,
        stacks_result=None,
        ocr=None,
        preflop=None,
        mano_result=None,
        time_sec=None,
    )

    assert spot_id is not None

    row = fetch_one(
        initialized_db,
        "SELECT * FROM spots WHERE id = ?",
        (spot_id,),
    )

    assert row is not None
    # Cuando time_sec es None, la columna time debe quedar NULL
    assert row["time"] is None

