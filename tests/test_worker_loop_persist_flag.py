from modules.workers.worker_loop import process_one_image
from modules.workers.worker_loop_types import LoopConfig


class DummyDbMod:
    pass


def test_process_one_image_does_not_persist_when_persist_to_db_false(monkeypatch):
    persist_calls = []

    def fake_persist_obs(*args, **kwargs):
        persist_calls.append((args, kwargs))

    monkeypatch.setattr("modules.workers.worker_loop.persist_obs", fake_persist_obs)

    cfg = LoopConfig(
        worker_id=1,
        interval_ms=3000,
        image_path=None,
        images_dir=None,
        loop_dir=False,
        region=None,
        max_ticks=None,
        print_every_tick=False,
        persist_without_stack=False,
    )

    def fake_run_preflop(_img_path):
        return {
            "preflop_ok": True,
            "modules": {
                "mano": {
                    "valid": True,
                    "mano_raw": "AsKd",
                    "hand_class": "AKo",
                },
                "noboard": {"noboard_ok": True},
            },
        }

    def fake_run_ocr(_img_path):
        return {
            "stacks": {"p1": 20.0},
            "bets": {"p2": 0.5, "p3": 1.0},
            "stackefectivo": {"value": 20.0},
            "names": {},
            "villano": {},
        }

    def fake_extract_modules(preflop):
        return (
            {
                "valid": True,
                "mano_raw": "AsKd",
                "hand_class": "AKo",
                "p1": 20.0,
            },
            {
                "p1": 20.0,
            },
        )

    def fake_compute_strategy(**_kwargs):
        return {
            "ok": False,
            "error": "no_strategy_for_test",
        }

    out, new_sig = process_one_image(
        cfg=cfg,
        mode="screen",
        img_path=r"C:\tmp\mesa_1.bmp",
        image_ref=r"C:\tmp\mesa_1.bmp",
        dbmod=DummyDbMod(),
        run_ocr_fn=fake_run_ocr,
        MatchInput=None,
        select_move=None,
        last_hand_sig=None,
        persist_to_db=False,
        run_preflop_fn=fake_run_preflop,
        extract_modules_fn=fake_extract_modules,
        compute_strategy_fn=fake_compute_strategy,
    )

    assert persist_calls == []
    assert out["persisted"] is False
    assert new_sig is not None
