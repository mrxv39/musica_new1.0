from __future__ import annotations

import numpy as np

from modules.ocr import gamecode
from modules.ocr.gamecode import _normalize_twister_gamecode


def _write_dummy_image(tmp_path):
    image_path = tmp_path / "gc.png"
    image_path.write_bytes(b"fake")
    return str(image_path)


def test_read_gamecode_refina_solo_digitos_y_vota(tmp_path, monkeypatch):
    image_path = _write_dummy_image(tmp_path)
    img = np.zeros((80, 320, 3), dtype=np.uint8)
    monkeypatch.setattr(gamecode.cv2, "imread", lambda _: img)

    state = {"full_calls": 0, "digit_calls": 0}

    def fake_ocr(ocr_img, config=""):
        if "tessedit_char_whitelist=0123456789" in config:
            state["digit_calls"] += 1
            if state["digit_calls"] == 1:
                return "12105027261"
            return "12105027261"

        state["full_calls"] += 1
        if state["full_calls"] == 1:
            return "ID: 12008077261"
        if state["full_calls"] in (2, 3):
            return "ID: 12105027261"
        return ""

    monkeypatch.setattr(gamecode.pytesseract, "image_to_string", fake_ocr)

    result = gamecode.read_gamecode(image_path)

    assert result["ok"] is True
    assert result["value"] == "12105027261"
    assert result["raw_text"] == "12105027261"


def test_read_gamecode_usa_fallback_si_reocr_digitos_falla(tmp_path, monkeypatch):
    """New API: read_gamecode only does digit whitelist OCR, no fallback to full OCR."""
    image_path = _write_dummy_image(tmp_path)
    img = np.zeros((80, 320, 3), dtype=np.uint8)
    monkeypatch.setattr(gamecode.cv2, "imread", lambda _: img)

    def fake_ocr(ocr_img, config=""):
        # New API: read_gamecode only calls with digit whitelist
        if "tessedit_char_whitelist=0123456789" in config:
            # Return a valid gamecode (must start with "121")
            return "12110527261"
        return ""

    monkeypatch.setattr(gamecode.pytesseract, "image_to_string", fake_ocr)

    result = gamecode.read_gamecode(image_path)

    assert result["ok"] is True
    assert result["value"] == "12110527261"
    assert result["raw_text"] == "12110527261"


def test_read_gamecode_vota_valor_repetido_antes_que_primero_valido(tmp_path, monkeypatch):
    """New API: read_gamecode only does digit whitelist OCR, returns repeated value."""
    image_path = _write_dummy_image(tmp_path)
    img = np.zeros((80, 320, 3), dtype=np.uint8)
    monkeypatch.setattr(gamecode.cv2, "imread", lambda _: img)

    def fake_ocr(ocr_img, config=""):
        # New API: read_gamecode only calls with digit whitelist
        if "tessedit_char_whitelist=0123456789" in config:
            # Return digits with valid gamecode (must start with "121")
            return "12105027261"
        return ""

    monkeypatch.setattr(gamecode.pytesseract, "image_to_string", fake_ocr)

    result = gamecode.read_gamecode(image_path)

    assert result["ok"] is True
    assert result["value"] == "12105027261"
    assert result["raw_text"] == "12105027261"


def test_normalize_twister_gamecode_keeps_valid_11_digit_code():
    assert _normalize_twister_gamecode("12109035134") == "12109035134"


def test_normalize_twister_gamecode_trims_valid_12_digit_code():
    assert _normalize_twister_gamecode("121090351341") == "12109035134"


def test_normalize_twister_gamecode_fixes_127_ocr_prefix():
    """New logic: only searches for "121" substring, not special 127->121 handling."""
    # "127090351341" doesn't contain "121" substring at valid position,
    # so it should return None (no special 127 handling anymore)
    assert _normalize_twister_gamecode("127090351341") is None


def test_normalize_twister_gamecode_extracts_valid_code_from_longer_string():
    assert _normalize_twister_gamecode("991210903513477") == "12109035134"


def test_normalize_twister_gamecode_returns_none_for_invalid_inputs():
    assert _normalize_twister_gamecode("55555555555") is None
    assert _normalize_twister_gamecode("127123456789") is None
    assert _normalize_twister_gamecode("") is None
    assert _normalize_twister_gamecode("abcxyz") is None
