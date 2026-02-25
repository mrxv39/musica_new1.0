# C:\Users\Usuario\Desktop\proyectos\poker_boss\modules\ocr\ocr.py
# OCR orchestrator: runs all OCR modules and merges results
# Follows the style of other OCR modules

from __future__ import annotations
import json
from typing import Dict, Any
from modules.ocr import stackefectivo, bets, stacks, names, villano, table_state, posiciones


def run_ocr(image_path: str, x1: int = 0, y1: int = 0) -> Dict[str, Any]:
    out: Dict[str, Any] = {
        "ok": False,
        "errors": [],
        "names": {},
        "villano": {},
        "stackefectivo": {},
        "bets": {},
        "stacks": {},
        "table_state": {},
        "posiciones": {},
    }

    # Run all OCR modules, catch errors, merge results
    try:
        out["stackefectivo"] = stackefectivo.read_stackefectivo(image_path, x1=x1, y1=y1)
    except Exception as e:
        out["errors"].append(f"stackefectivo:{e}")

    try:
        out["bets"] = bets.read_bets(image_path, x1=x1, y1=y1)
    except Exception as e:
        out["errors"].append(f"bets:{e}")

    try:
        out["stacks"] = stacks.read_stacks(image_path, x1=x1, y1=y1)
    except Exception as e:
        out["errors"].append(f"stacks:{e}")

    try:
        out["names"] = names.read_names(image_path, x1=x1, y1=y1)
    except Exception as e:
        out["errors"].append(f"names:{e}")

    # Villano: pass precomputed names if available (required by tests)
    try:
        villano_args: Dict[str, Any] = dict(image_path=image_path, x1=x1, y1=y1)
        if out.get("names") and isinstance(out["names"], dict):
            villano_args["p2_name"] = out["names"].get("p2_name", "")
            villano_args["p3_name"] = out["names"].get("p3_name", "")
        if hasattr(villano, "classify_villano"):
            out["villano"] = villano.classify_villano(**villano_args)
        else:
            out["villano"] = {}
    except Exception as e:
        out["errors"].append(f"villano:{e}")

    # Derive table state (3H / HU)
    try:
        out["table_state"] = table_state.compute_table_state(out.get("names"), out.get("stacks"))
    except Exception as e:
        out["errors"].append(f"table_state:{e}")
        out["table_state"] = {"ok": False, "errors": [str(e)]}

    # Derive positions (BTN/SB/BB) from table_state + bets (safe heuristic)
    try:
        out["posiciones"] = posiciones.read_posiciones(out.get("table_state"), out.get("bets"))
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
        out.get("posiciones", {}).get("ok"),
    ]
    out["ok"] = any(bool(x) for x in oks)

    # Aggregate errors from submodules
    for k in ("stackefectivo", "bets", "stacks", "names", "villano", "table_state", "posiciones"):
        errs = out.get(k, {}).get("errors")
        if errs:
            out["errors"].extend([f"{k}:{e}" for e in errs])

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
