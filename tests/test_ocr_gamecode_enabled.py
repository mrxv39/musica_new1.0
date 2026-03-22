"""
Guard test: gamecode OCR must NEVER be disabled in the worker pipeline.

If this test fails, someone hardcoded gamecode as disabled/skipped in ocr.py.
Re-enable it — gamecode is required to link spots to hands.
"""

import inspect

from modules.ocr import ocr


def test_run_ocr_source_does_not_skip_gamecode():
    """The source of run_ocr must not contain 'gamecode_disabled' or 'gamecode_skipped'."""
    source = inspect.getsource(ocr.run_ocr)
    assert "gamecode_disabled" not in source, (
        "run_ocr contains 'gamecode_disabled' — gamecode OCR must stay enabled"
    )
    assert "gamecode_skipped" not in source, (
        "run_ocr contains 'gamecode_skipped' — gamecode OCR must stay enabled"
    )


def test_run_ocr_source_calls_read_gamecode():
    """The source of run_ocr must call gamecode.read_gamecode."""
    source = inspect.getsource(ocr.run_ocr)
    assert "gamecode.read_gamecode" in source, (
        "run_ocr does not call gamecode.read_gamecode — gamecode OCR must stay enabled"
    )
