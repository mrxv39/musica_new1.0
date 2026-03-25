from modules.preflop.workers_loop.mesa_config import build_time_bbox


def test_build_time_bbox_uses_legacy_time_roi_relative_to_each_table():
    area1 = {"mesa": 1, "x1": 520, "y1": 210, "x2": 1296, "y2": 807}
    area2 = {"mesa": 2, "x1": 520, "y1": 807, "x2": 1296, "y2": 1404}
    area3 = {"mesa": 3, "x1": 1296, "y1": 210, "x2": 2072, "y2": 807}
    area4 = {"mesa": 4, "x1": 1296, "y1": 807, "x2": 2072, "y2": 1404}

    assert build_time_bbox(area1) == (870, 680, 920, 695)
    assert build_time_bbox(area2) == (870, 1277, 920, 1292)
    assert build_time_bbox(area3) == (1646, 680, 1696, 695)
    assert build_time_bbox(area4) == (1646, 1277, 1696, 1292)
