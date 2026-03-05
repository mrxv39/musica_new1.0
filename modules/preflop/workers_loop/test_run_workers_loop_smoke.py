# C:\Users\Usuario\Desktop\proyectos\poker_boss\modules\preflop\workers_loop\test_run_workers_loop_smoke.py
from __future__ import annotations

import os
import sys
import tempfile
import unittest

# Asegura que el project root esté en sys.path
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from modules.preflop.workers_loop import loop_runner


class TestRunWorkersLoopSmoke(unittest.TestCase):
    def test_smoke_routing_and_log(self):
        """
        Verifica que el loop:
        - crea dirs
        - escribe log
        - mueve img a borrar/errors/ok según preflop y strategy
        """
        with tempfile.TemporaryDirectory() as td:
            base_dir = os.path.abspath(td)

            # Parchea AREAS a 3 mesas (evitamos la 4ª por simplicidad)
            loop_runner.AREAS = [
                {"mesa": 1, "x1": 0, "y1": 0, "x2": 10, "y2": 10},
                {"mesa": 2, "x1": 0, "y1": 0, "x2": 10, "y2": 10},
                {"mesa": 3, "x1": 0, "y1": 0, "x2": 10, "y2": 10},
            ]

            # --- Mocks ---
            created = {"mesa1": None, "mesa2": None, "mesa3": None}

            def fake_capture_to_tmp(area, tmp_dir, ts):
                mesa = int(area["mesa"])
                p = os.path.join(tmp_dir, f"{ts}__mesa_{mesa}.bmp")
                # crea archivo dummy
                with open(p, "wb") as f:
                    f.write(b"BM")  # cabecera mínima fake
                if mesa == 1:
                    created["mesa1"] = p
                elif mesa == 2:
                    created["mesa2"] = p
                elif mesa == 3:
                    created["mesa3"] = p
                return p

            def fake_run_preflop(img_path: str):
                # Mesa2 -> preflop FAIL
                if img_path.endswith("__mesa_2.bmp"):
                    return {"preflop_ok": False, "modules": {"mano": {"mano_ok": False}, "noboard": {"noboard_ok": True}}}
                # Mesa1 y Mesa3 -> preflop OK
                return {"preflop_ok": True, "modules": {"mano": {"mano_ok": True}, "noboard": {"noboard_ok": True}}}

            def fake_extract_modules(preflop):
                # mano_result mínimo
                return ({"hand": "99"}, {"dummy": True})

            def fake_build_ocr_safe(img_path: str):
                return {"stacks": {}, "bets": {}, "stackefectivo": {}, "villano": {}}

            def fake_compute_strategy_safe(preflop, mano_result, ocr):
                # Mesa1 -> OK con move/bets
                # Mesa3 -> NO STRATEGY
                # Deducimos mesa por mano_result/imagen (aquí por mano_result fijo, miramos preflop no da)
                # usamos un hack: si mano_result hand=99 y preflop_ok true, se decide por "mesa_3" en filename?
                # Mejor: el img_path no está aquí, así que usamos un marcador en ocr:
                # (lo metemos desde fake_build_ocr_safe si fuese necesario). Por simplicidad:
                # decidimos que la primera llamada ok y la segunda no.
                if not hasattr(fake_compute_strategy_safe, "_count"):
                    fake_compute_strategy_safe._count = 0  # type: ignore
                fake_compute_strategy_safe._count += 1  # type: ignore

                if fake_compute_strategy_safe._count == 1:  # mesa1
                    return ({"ok": True, "move": "OR", "betmin": 2.5, "betmax": 2.5}, "")
                return ({"ok": False, "error": "no_match"}, "no_match")

            # Parchamos en el módulo
            loop_runner.capture_to_tmp = fake_capture_to_tmp
            loop_runner.extract_modules = fake_extract_modules
            loop_runner.build_ocr_safe = fake_build_ocr_safe
            loop_runner.compute_strategy_safe = fake_compute_strategy_safe

            # Parchea import local run_preflop: está dentro de run_loop, así que parcheamos el módulo objetivo antes de llamar
            import modules.workers.worker_preflop as worker_preflop_mod
            worker_preflop_mod.run_preflop = fake_run_preflop

            # Cortar el bucle infinito tras 1 ciclo:
            orig_sleep = loop_runner.time.sleep

            def stop_sleep(_):
                raise StopIteration("stop after 1 cycle")

            loop_runner.time.sleep = stop_sleep

            # Ejecuta
            dirs = loop_runner.ensure_dirs(base_dir)
            with open(dirs.log_path, "a", encoding="utf-8") as fp:
                try:
                    loop_runner.run_loop(out_dir=base_dir, interval_ms=200, verbose=True, fp=fp)
                except StopIteration:
                    pass
                finally:
                    loop_runner.time.sleep = orig_sleep

            # Asserts: existen los ficheros movidos
            ok_files = os.listdir(dirs.ok_dir)
            err_files = os.listdir(dirs.err_dir)
            del_files = os.listdir(dirs.del_dir)

            self.assertEqual(len(ok_files), 1, f"Expected 1 ok file, got: {ok_files}")
            self.assertEqual(len(err_files), 1, f"Expected 1 error file, got: {err_files}")
            self.assertEqual(len(del_files), 1, f"Expected 1 borrar file, got: {del_files}")

            # Log existe y tiene START
            self.assertTrue(os.path.exists(dirs.log_path), "log file not created")
            with open(dirs.log_path, "r", encoding="utf-8") as f:
                log_txt = f.read()
            self.assertIn("START run_workers_loop", log_txt)
            self.assertIn("POKER_BOSS_FALLBACK_SE", log_txt)


if __name__ == "__main__":
    unittest.main(verbosity=2)
