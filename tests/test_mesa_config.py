from modules.preflop.workers_loop import mesa_config as mc


def test_get_area_by_mesa_devuelve_area_existente():
    area = mc.get_area_by_mesa(1)

    assert isinstance(area, dict)
    assert int(area["mesa"]) == 1
    assert "x1" in area
    assert "y1" in area


def test_get_area_by_mesa_acepta_str_convertible():
    area = mc.get_area_by_mesa("2")

    assert int(area["mesa"]) == 2


def test_get_area_by_mesa_lanza_si_no_existe():
    try:
        mc.get_area_by_mesa(999)
        assert False, "Se esperaba ValueError"
    except ValueError as e:
        assert str(e) == "mesa_not_found:999"


def test_build_time_bbox_suma_roi_relativo():
    area = {"mesa": 1, "x1": 100, "y1": 200, "ancho": 776, "alto": 597}

    bbox = mc.build_time_bbox(area)

    assert bbox == (450, 670, 500, 685)
