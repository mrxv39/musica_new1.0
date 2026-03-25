import os

from modules.workers.worker_preflop import run_preflop_subprocess


def test_run_preflop_subprocess_uses_existing_entrypoint_for_missing_image():
    out = run_preflop_subprocess(r"C:\no_existe\imagen.bmp", timeout_sec=12)

    assert isinstance(out, dict)
    assert out.get("preflop_ok") is False

    stderr = str(out.get("stderr", "") or "")
    stdout = str(out.get("stdout", "") or "")
    joined = stderr + "\n" + stdout

    assert "run_preflop.py" not in joined
    assert "can't open file" not in joined

    # Debe venir del entrypoint real y devolver estructura JSON de preflop,
    # no fallar por script inexistente.
    assert "modules" in out or "errors" in out or out.get("error")
