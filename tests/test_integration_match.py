import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PRE = ROOT / "modules" / "preflop"
if str(PRE) not in sys.path:
    sys.path.insert(0, str(PRE))

from link_spots_utils import build_spots_by_region, load_spots
from link_spots_matching import choose_candidates_for_room, closest_spot


def test_load_spots_y_matching_por_room(tmp_path):
    r1 = [520, 210, 776, 597]
    r2 = [520, 807, 776, 597]

    (tmp_path / "spot_1.json").write_text(
        json.dumps({"ts_ms": 1000, "saved_path": "img1.png", "region": r1, "spot_hash": "a"}),
        encoding="utf-8",
    )
    (tmp_path / "spot_2.json").write_text(
        json.dumps({"ts_ms": 1100, "saved_path": "img2.png", "region": r2, "spot_hash": "b"}),
        encoding="utf-8",
    )
    (tmp_path / "spot_3.json").write_text(
        json.dumps({"ts_ms": 1200, "saved_path": "img3.png", "region": r1, "spot_hash": "c"}),
        encoding="utf-8",
    )

    spots = load_spots(str(tmp_path))
    by_region = build_spots_by_region(spots)

    candidates = choose_candidates_for_room("mesa 1", spots, by_region)
    best = closest_spot(candidates, 1190, 500)

    assert len(candidates) == 2
    assert best is not None
    assert best["ts_ms"] == 1200


def test_closest_spot_sin_room_mapeable_usa_todos(tmp_path):
    (tmp_path / "spot_1.json").write_text(
        json.dumps({"ts_ms": 1000, "saved_path": "img1.png", "region": [520, 210, 776, 597], "spot_hash": "a"}),
        encoding="utf-8",
    )
    (tmp_path / "spot_2.json").write_text(
        json.dumps({"ts_ms": 2000, "saved_path": "img2.png", "region": [520, 807, 776, 597], "spot_hash": "b"}),
        encoding="utf-8",
    )

    spots = load_spots(str(tmp_path))
    by_region = build_spots_by_region(spots)

    candidates = choose_candidates_for_room("championpoker", spots, by_region)
    best = closest_spot(candidates, 1900, 500)

    assert len(candidates) == 2
    assert best is not None
    assert best["ts_ms"] == 2000
