# C:\Users\Usuario\Desktop\proyectos\poker_boss\modules\ocr\ocr.py
# OCR orchestrator: runs all OCR modules and merges results

from __future__ import annotations

import json
import os
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any, Dict, Optional

import cv2
import numpy as np

from modules.ocr import (
    bets,
    stacks,
    names,
    villano,
    table_state,
    dealer,
    posiciones,
    gamecode,
)


def _load_images_once(
    image_path: str,
) -> tuple[Optional[np.ndarray], Optional[np.ndarray]]:
    """Load gray and color images once; returns (img_gray, img_color)."""
    if not image_path:
        return None, None
    try:
        img_color = cv2.imread(image_path)
        if img_color is None:
            return None, None
        img_gray = cv2.cvtColor(img_color, cv2.COLOR_BGR2GRAY)
        return img_gray, img_color
    except Exception:
        return None, None


def run_ocr(image_path: str, x1: int = 0, y1: int = 0) -> Dict[str, Any]:
    t_global0 = time.perf_counter()
    out: Dict[str, Any] = {
        "ok": False,
        "errors": [],
        "names": {},
        "villano": {},
        "stackefectivo": {},
        "bets": {},
        "stacks": {},
        "table_state": {},
        "dealer": {},
        "posiciones": {},
        "gamecode": {},
    }

    t_pre0 = time.perf_counter()
    img_gray, img_color = _load_images_once(image_path)
    t_pre1 = time.perf_counter()
    timings: Dict[str, float] = {
        "ocr_preprocess": t_pre1 - t_pre0,
        "ocr_bets": None,
        "ocr_stacks": None,
        "ocr_names": None,
        "ocr_dealer": None,
        "ocr_table_state": None,
        "ocr_posiciones": None,
        "ocr_total_internal": None,
    }

    # Sequential (default) when POKER_BOSS_WORKER_SEQUENTIAL=1 or POKER_BOSS_OCR_SEQUENTIAL=1.
    # Thread parallelism can increase time due to GIL; sequential is recommended for lower latency.
    _ocr_sequential = (
        os.environ.get("POKER_BOSS_WORKER_SEQUENTIAL", "1") == "1"
        or os.environ.get("POKER_BOSS_OCR_SEQUENTIAL", "1") == "1"
    )

    if _ocr_sequential:
        # Sequential path: single-threaded OCR phases, same single image load.
        try:
            t0 = time.perf_counter()
            out["bets"] = bets.read_bets(image_path, x1=x1, y1=y1, img_gray=img_gray)
            timings["ocr_bets"] = time.perf_counter() - t0
        except Exception as e:
            out["errors"].append(f"bets:{e}")
        try:
            t0 = time.perf_counter()
            out["stacks"] = stacks.read_stacks(image_path, x1=x1, y1=y1, img_gray=img_gray)
            timings["ocr_stacks"] = time.perf_counter() - t0
        except Exception as e:
            out["errors"].append(f"stacks:{e}")
        try:
            t0 = time.perf_counter()
            out["names"] = names.read_names(image_path, x1=x1, y1=y1, img_gray=img_gray)
            timings["ocr_names"] = time.perf_counter() - t0
        except Exception as e:
            out["errors"].append(f"names:{e}")
        try:
            p2_name = (out.get("names") or {}).get("p2_name", "")
            p3_name = (out.get("names") or {}).get("p3_name", "")
            villano_args = dict(image_path=image_path, x1=x1, y1=y1, p2_name=p2_name, p3_name=p3_name)
            if hasattr(villano, "classify_villano"):
                out["villano"] = villano.classify_villano(**villano_args)
            else:
                out["villano"] = {}
        except Exception as e:
            out["errors"].append(f"villano:{e}")
        try:
            t0 = time.perf_counter()
            out["table_state"] = table_state.compute_table_state(out.get("names"), out.get("stacks"), out.get("bets"))
            timings["ocr_table_state"] = time.perf_counter() - t0
        except Exception as e:
            out["errors"].append(f"table_state:{e}")
            out["table_state"] = {"ok": False, "errors": [str(e)]}
        active_seats = (out.get("table_state") or {}).get("active_seats") or None
        try:
            t0 = time.perf_counter()
            out["dealer"] = dealer.read_dealer(
                image_path, x1=x1, y1=y1, active_seats=active_seats, img_color=img_color
            )
            timings["ocr_dealer"] = time.perf_counter() - t0
        except Exception as e:
            out["errors"].append(f"dealer:{e}")
            out["dealer"] = {"ok": False, "errors": [str(e)]}
        try:
            t0 = time.perf_counter()
            out["gamecode"] = gamecode.read_gamecode(image_path, x1=x1, y1=y1)
            timings["ocr_gamecode"] = time.perf_counter() - t0
        except Exception as e:
            out["errors"].append(f"gamecode:{e}")
            out["gamecode"] = {"ok": False, "errors": [str(e)]}
    else:
        # Parallel path (POKER_BOSS_WORKER_SEQUENTIAL=0 and POKER_BOSS_OCR_SEQUENTIAL=0): thread pools.
        def _run_bets():
            try:
                t0 = time.perf_counter()
                res = bets.read_bets(image_path, x1=x1, y1=y1, img_gray=img_gray)
                return ("bets", res, time.perf_counter() - t0)
            except Exception as e:
                return ("bets", {"ok": False, "errors": [str(e)]}, 0.0)

        def _run_stacks():
            try:
                t0 = time.perf_counter()
                res = stacks.read_stacks(image_path, x1=x1, y1=y1, img_gray=img_gray)
                return ("stacks", res, time.perf_counter() - t0)
            except Exception as e:
                return ("stacks", {"ok": False, "errors": [str(e)]}, 0.0)

        def _run_names():
            try:
                t0 = time.perf_counter()
                res = names.read_names(image_path, x1=x1, y1=y1, img_gray=img_gray)
                return ("names", res, time.perf_counter() - t0)
            except Exception as e:
                return ("names", {"ok": False, "errors": [str(e)]}, 0.0)

        with ThreadPoolExecutor(max_workers=3) as exec1:
            f1 = exec1.submit(_run_bets)
            f2 = exec1.submit(_run_stacks)
            f3 = exec1.submit(_run_names)
            for fut in as_completed([f1, f2, f3]):
                try:
                    key, val, dt = fut.result()
                    out[key] = val
                    if key == "bets":
                        timings["ocr_bets"] = dt
                    elif key == "stacks":
                        timings["ocr_stacks"] = dt
                    elif key == "names":
                        timings["ocr_names"] = dt
                except Exception as e:
                    out["errors"].append(f"parallel_ocr_future_error:{e}")

        try:
            p2_name = (out.get("names") or {}).get("p2_name", "")
            p3_name = (out.get("names") or {}).get("p3_name", "")
            villano_args = dict(image_path=image_path, x1=x1, y1=y1, p2_name=p2_name, p3_name=p3_name)
            if hasattr(villano, "classify_villano"):
                out["villano"] = villano.classify_villano(**villano_args)
            else:
                out["villano"] = {}
        except Exception as e:
            out["errors"].append(f"villano:{e}")

        try:
            out["table_state"] = table_state.compute_table_state(out.get("names"), out.get("stacks"), out.get("bets"))
        except Exception as e:
            out["errors"].append(f"table_state:{e}")
            out["table_state"] = {"ok": False, "errors": [str(e)]}

        active_seats = (out.get("table_state") or {}).get("active_seats") or None

        def _run_dealer():
            try:
                t0 = time.perf_counter()
                res = dealer.read_dealer(
                    image_path, x1=x1, y1=y1, active_seats=active_seats, img_color=img_color
                )
                return ("dealer", res, time.perf_counter() - t0)
            except Exception as e:
                return ("dealer", {"ok": False, "errors": [str(e)]}, 0.0)

        with ThreadPoolExecutor(max_workers=1) as exec2:
            fd = exec2.submit(_run_dealer)
            try:
                key_d, val_d, dt_d = fd.result()
                out[key_d] = val_d
                timings["ocr_dealer"] = dt_d
            except Exception as e:
                out["errors"].append(f"parallel_dealer_future_error:{e}")
                out["dealer"] = {"ok": False, "errors": [str(e)]}

        try:
            t0 = time.perf_counter()
            out["gamecode"] = gamecode.read_gamecode(image_path, x1=x1, y1=y1)
            timings["ocr_gamecode"] = time.perf_counter() - t0
        except Exception as e:
            out["errors"].append(f"gamecode:{e}")
            out["gamecode"] = {"ok": False, "errors": [str(e)]}

    # Posiciones (depends on table_state, bets, dealer)
    try:
        t0 = time.perf_counter()
        out["posiciones"] = posiciones.read_posiciones(out.get("table_state"), out.get("bets"), out.get("dealer"))
        timings["ocr_posiciones"] = time.perf_counter() - t0
    except Exception as e:
        out["errors"].append(f"posiciones:{e}")
        out["posiciones"] = {"ok": False, "errors": [str(e)]}

    # ok = True if any submodule ok is True
    oks = [
        out.get("stackefectivo", {}).get("ok"),
        out.get("bets", {}).get("ok"),
        out.get("stacks", {}).get("ok"),
        out.get("names", {}).get("ok"),
        out.get("villano", {}).get("ok"),
        out.get("table_state", {}).get("ok"),
        out.get("dealer", {}).get("ok"),
        out.get("posiciones", {}).get("ok"),
    ]
    out["ok"] = any(bool(x) for x in oks)

    # Aggregate errors from submodules
    for k in (
        "stackefectivo",
        "bets",
        "stacks",
        "names",
        "villano",
        "table_state",
        "dealer",
        "posiciones",
        "gamecode",
    ):
        errs = out.get(k, {}).get("errors")
        if errs:
                out["errors"].extend([f"{k}:{e}" for e in errs])
        if k == "gamecode":
            err = out.get(k, {}).get("error")
            if err:
                out["errors"].append(f"{k}:{err}")

    timings.setdefault("ocr_total_internal", time.perf_counter() - t_global0)
    if timings:
        out["_timings"] = timings

    return out


if __name__ == "__main__":
    import sys

    image_path = None
    if "--image" in sys.argv:
        try:
            image_path = sys.argv[sys.argv.index("--image") + 1]
        except Exception:
            image_path = None

    res = run_ocr(image_path) if image_path else {"ok": False, "errors": ["no_image"]}
    print(json.dumps(res, ensure_ascii=False))
