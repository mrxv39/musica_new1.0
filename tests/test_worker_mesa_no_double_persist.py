from pathlib import Path
from types import SimpleNamespace

from modules.preflop.workers_loop import worker_mesa as wmod


class DummyDbMod:
    def __init__(self):
        self.capture_id = 123

    def find_recent_capture_by_fingerprint(self, **_kwargs):
        return None

    def insert_worker_capture(self, **_kwargs):
        return self.capture_id

    def update_worker_capture_ocr(self, **_kwargs):
        return True

    def update_worker_capture_route(self, **_kwargs):
        return True

    def insert_obs(self, **_kwargs):
        return 999


def test_run_worker_mesa_once_calls_process_one_image_with_persist_to_db_false(tmp_path, monkeypatch):
    img_src = tmp_path / "fixed_input.bmp"
    img_src.write_bytes(b"fake-bmp-data")

    dirs = SimpleNamespace(
        ok_dir=str(tmp_path / "ok"),
        err_dir=str(tmp_path / "errors"),
        del_dir=str(tmp_path / "borrar"),
        tmp_dir=str(tmp_path / "_tmp"),
    )
    Path(dirs.ok_dir).mkdir(parents=True, exist_ok=True)
    Path(dirs.err_dir).mkdir(parents=True, exist_ok=True)
    Path(dirs.del_dir).mkdir(parents=True, exist_ok=True)
    Path(dirs.tmp_dir).mkdir(parents=True, exist_ok=True)

    monkeypatch.setattr(wmod, "get_file_fingerprint", lambda _p: "image_fp_test")
    monkeypatch.setattr(wmod, "run_ocr", lambda _p: {"ok": True, "bets": {"p2": 0.5, "p3": 1.0}})
    monkeypatch.setattr(
        wmod,
        "_run_preflop_direct",
        lambda _p: {
            "preflop_ok": True,
            "modules": {
                "mano": {"valid": True, "mano_raw": "AsKd", "hand_class": "AKo"},
                "noboard": {"noboard_ok": True},
            },
        },
    )
    monkeypatch.setattr(wmod, "write_time_mano_candidate", lambda **_kwargs: None)
    monkeypatch.setattr(wmod, "preflop_fail", lambda _p: False)
    monkeypatch.setattr(
        wmod,
        "force_ok_on_default_fold",
        lambda strategy: strategy,
    )
    monkeypatch.setattr(
        wmod,
        "has_strategy_move",
        lambda _strategy: False,
    )
    monkeypatch.setattr(
        wmod,
        "persist_preflop_obs",
        lambda **_kwargs: 555,
    )
    monkeypatch.setattr(
        wmod,
        "safe_move",
        lambda src, dst_dir: str(Path(dst_dir) / Path(src).name),
    )
    monkeypatch.setattr(wmod, "update_obs_frame_ref", lambda *args, **kwargs: True)

    captured = {}

    def fake_process_one_image(**kwargs):
        captured.update(kwargs)
        return (
            {
                "persisted": False,
                "strategy": {"ok": False, "error": "no_strategy"},
            },
            "sig_test",
        )

    monkeypatch.setattr(wmod, "process_one_image", fake_process_one_image)

    fp = open(tmp_path / "worker.log", "w", encoding="utf-8")
    try:
        wmod.run_worker_mesa_once(
            area={"mesa": 1, "x1": 0, "y1": 0, "x2": 100, "y2": 100},
            dirs=dirs,
            ts="20260310_150000_000000",
            interval_ms=3000,
            verbose=False,
            fp=fp,
            fixed_input=str(img_src),
            last_sig_by_mesa={},
            dbg=False,
            dbmod=DummyDbMod(),
            MatchInput=None,
            select_move=None,
            extract_modules_fn=lambda _p: (
                {"valid": True, "mano_raw": "AsKd", "hand_class": "AKo", "p1": 20.0},
                {"p1": 20.0},
            ),
            build_ocr_safe_fn=None,
            compute_strategy_safe_fn=lambda preflop, mano_result, ocr: ({"ok": False, "error": "no_strategy"}, None),
        )
    finally:
        fp.close()

    assert captured["persist_to_db"] is False
