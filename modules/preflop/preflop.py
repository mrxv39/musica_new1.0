# C:\Users\Usuario\Desktop\proyectos\poker_boss\modules\preflop\preflop.py
import sys
import os
import json
import time as t
import hashlib
import concurrent.futures

# Ensure project root is on sys.path for both import and subprocess modes
_PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if _PROJECT_ROOT not in sys.path:
    sys.path.insert(0, _PROJECT_ROOT)

from modules.preflop.mano import run_mano, load_templates, load_suit_templates
from modules.preflop.time import run_time
from modules.preflop.board_state import run_board_state


def _sha1(s: str) -> str:
    return hashlib.sha1(s.encode("utf-8", errors="ignore")).hexdigest()


def _fingerprint(image_path: str) -> str:
    abs_image_path = os.path.abspath(image_path or "")
    return _sha1(abs_image_path + "|preflop|" + str(int(t.time()) // 2))


def extract_ok_flag(name: str, data: dict) -> bool:
    if not isinstance(data, dict):
        return False

    if name == "mano":
        hand_class = data.get("hand_class", "")
        mano_raw = data.get("mano_raw", "")
        return bool(hand_class and mano_raw)

    if name == "time":
        return bool(data.get("time_ok", False))

    if name == "board_state":
        return str(data.get("street_state", "")).strip().lower() == "preflop"

    return False


def run_preflop(image_path: str, rank_templates=None, suit_templates=None) -> dict:
    """Run the full preflop pipeline via direct function calls (no subprocess)."""
    try:
        abs_image_path = os.path.abspath(image_path)
        if not os.path.exists(abs_image_path):
            raise Exception("Image not found")

        fp = _fingerprint(abs_image_path)

        # Preload templates once (shared across mano + board_state)
        if rank_templates is None:
            rank_templates = load_templates()
        if suit_templates is None:
            suit_templates = load_suit_templates()

        results = {}
        errors = []

        with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
            fut_mano = executor.submit(run_mano, abs_image_path, rank_templates, suit_templates)
            fut_time = executor.submit(run_time, abs_image_path)
            fut_board = executor.submit(run_board_state, abs_image_path, rank_templates)

            for name, fut in [("mano", fut_mano), ("time", fut_time), ("board_state", fut_board)]:
                try:
                    data = fut.result(timeout=10)
                    results[name] = data
                    if data.get("error"):
                        errors.append(f"{name}: {data['error']}")
                except Exception as e:
                    results[name] = {"error": f"{type(e).__name__}: {e}"}
                    errors.append(f"{name}: {type(e).__name__}: {e}")

        mano_ok = extract_ok_flag("mano", results.get("mano", {}))
        time_ok = extract_ok_flag("time", results.get("time", {}))
        board_preflop_ok = extract_ok_flag("board_state", results.get("board_state", {}))

        preflop_ok = bool(mano_ok and time_ok and board_preflop_ok)

        return {
            "preflop_ok": preflop_ok,
            "fingerprint": fp,
            "modules": results,
            "errors": errors,
        }

    except Exception as e:
        fp = _fingerprint(image_path)
        msg = str(e)
        return {
            "preflop_ok": False,
            "fingerprint": fp,
            "modules": {
                "mano": {"error": msg, "mano_ok": False},
                "time": {"error": msg, "time_ok": False},
                "board_state": {"error": msg, "street_state": "unknown", "valid_count": 0},
            },
            "errors": [msg],
        }


def main():
    """CLI entry point — still works as subprocess for backward compat."""
    try:
        if "--image" not in sys.argv:
            raise Exception("Missing --image argument")
        image_path = sys.argv[sys.argv.index("--image") + 1]
        out = run_preflop(image_path)
        print(json.dumps(out))
    except Exception as e:
        image_path = ""
        try:
            image_path = sys.argv[sys.argv.index("--image") + 1]
        except Exception:
            pass
        fp = _fingerprint(image_path)
        out = {
            "preflop_ok": False,
            "fingerprint": fp,
            "modules": {},
            "errors": [str(e)],
        }
        print(json.dumps(out))


if __name__ == "__main__":
    main()
