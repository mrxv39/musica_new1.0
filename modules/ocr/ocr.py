# OCR orchestrator: runs all OCR modules and merges results
# Follows the style of other OCR modules

from __future__ import annotations
import json
from typing import Dict, Any
from modules.ocr import stackefectivo, bets, stacks, names, villano

def run_ocr(image_path: str, x1: int = 0, y1: int = 0) -> Dict[str, Any]:
    out = {
        "ok": False,
        "errors": [],
        "names": {},
        "villano": {},
        "stackefectivo": {},
        "bets": {},
        "stacks": {},
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
    try:
        # Pass precomputed names to villano if possible
        villano_args = dict(image_path=image_path, x1=x1, y1=y1)
        if out["names"] and (out["names"].get("p2_name") or out["names"].get("p3_name")):
            villano_args["p2_name"] = out["names"].get("p2_name", "")
            villano_args["p3_name"] = out["names"].get("p3_name", "")
        if hasattr(villano, "classify_villano"):
            out["villano"] = villano.classify_villano(**villano_args)
        else:
            out["villano"] = {}
    except Exception as e:
        out["errors"].append(f"villano:{e}")
    # ok = True if any submodule ok is True
    oks = [
        out.get("stackefectivo", {}).get("ok"),
        out.get("bets", {}).get("ok"),
        out.get("stacks", {}).get("ok"),
        out.get("names", {}).get("ok"),
        out.get("villano", {}).get("ok"),
    ]
    out["ok"] = any(oks)
    # Aggregate errors from submodules
    for k in ("stackefectivo", "bets", "stacks", "names", "villano"):
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
