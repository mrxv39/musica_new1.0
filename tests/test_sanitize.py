import sys
sys.path.append(r"C:\Users\Usuario\Desktop\proyectos\poker_boss\modules\preflop")

from link_spots_utils import sanitize_folder_name


def test_basic():
    assert sanitize_folder_name("12345")=="12345"


def test_spaces():
    assert sanitize_folder_name("123 45")=="123_45"


def test_invalid_chars():
    assert sanitize_folder_name("123/45")=="123_45"
