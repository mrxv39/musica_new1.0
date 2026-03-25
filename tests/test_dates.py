import sys
sys.path.append(r"C:\Users\Usuario\Desktop\proyectos\poker_boss\modules\preflop")

from link_spots_utils import parse_startdate_to_ms


def test_parse_standard():
    ts=parse_startdate_to_ms("2026-03-05 10:11:49")
    assert isinstance(ts,int)


def test_parse_iso():
    ts=parse_startdate_to_ms("2026-03-05T10:11:49")
    assert isinstance(ts,int)


def test_parse_epoch_seconds():
    ts=parse_startdate_to_ms("1772701910")
    assert ts>0


def test_parse_invalid():
    assert parse_startdate_to_ms("xxx")==None
