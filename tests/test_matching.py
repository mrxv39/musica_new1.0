import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PRE = ROOT / "modules" / "preflop"
if str(PRE) not in sys.path:
    sys.path.insert(0, str(PRE))

from link_spots_matching import closest_spot, choose_candidates_for_room


def test_closest_spot_devuelve_el_mas_cercano():
    spots = [
        {"ts_ms": 1000},
        {"ts_ms": 2000},
        {"ts_ms": 3000},
    ]

    res = closest_spot(spots, 2100, 2000)

    assert res is not None
    assert res["ts_ms"] == 2000


def test_closest_spot_fuera_de_ventana_devuelve_none():
    spots = [
        {"ts_ms": 1000},
        {"ts_ms": 2000},
        {"ts_ms": 3000},
    ]

    res = closest_spot(spots, 10000, 500)

    assert res is None


def test_closest_spot_target_none_devuelve_none():
    spots = [{"ts_ms": 1000}]
    assert closest_spot(spots, None, 1000) is None


def test_closest_spot_lista_vacia_devuelve_none():
    assert closest_spot([], 1000, 1000) is None


def test_closest_spot_respeta_lista_ordenada_y_para_en_hi():
    spots = [
        {"ts_ms": 1000},
        {"ts_ms": 2000},
        {"ts_ms": 3000},
        {"ts_ms": 100000},
    ]

    res = closest_spot(spots, 2100, 150)

    assert res is not None
    assert res["ts_ms"] == 2000


def test_choose_candidates_for_room_filtra_por_region():
    spots_all = [
        {"ts_ms": 1000, "region": (520, 210, 776, 597)},
        {"ts_ms": 2000, "region": (520, 807, 776, 597)},
    ]
    spots_by_region = {
        (520, 210, 776, 597): [spots_all[0]],
        (520, 807, 776, 597): [spots_all[1]],
    }

    res = choose_candidates_for_room("mesa 1", spots_all, spots_by_region)

    assert res == [spots_all[0]]


def test_choose_candidates_for_room_si_room_no_mapea_devuelve_todos():
    spots_all = [
        {"ts_ms": 1000, "region": (520, 210, 776, 597)},
        {"ts_ms": 2000, "region": (520, 807, 776, 597)},
    ]
    spots_by_region = {
        (520, 210, 776, 597): [spots_all[0]],
        (520, 807, 776, 597): [spots_all[1]],
    }

    res = choose_candidates_for_room("championpoker", spots_all, spots_by_region)

    assert res == spots_all
