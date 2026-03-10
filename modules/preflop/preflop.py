# C:\Users\Usuario\Desktop\proyectos\poker_boss\modules\preflop\preflop.py
import sys
import os
import json
import time as t
import hashlib
import concurrent.futures
import subprocess

MANO_PATH = os.path.join(os.path.dirname(__file__), "mano.py")
TIME_PATH = os.path.join(os.path.dirname(__file__), "time.py")
BOARD_STATE_PATH = os.path.join(os.path.dirname(__file__), "board_state.py")

MODULES = {
    "mano": (MANO_PATH, "mano_ok"),
    "time": (TIME_PATH, "time_ok"),
    "board_state": (BOARD_STATE_PATH, "street_state"),
}


def _sha1(s: str) -> str:
    return hashlib.sha1(s.encode("utf-8", errors="ignore")).hexdigest()


def _fingerprint(image_path: str) -> str:
    abs_image_path = os.path.abspath(image_path or "")
    return _sha1(abs_image_path + "|preflop|" + str(int(t.time()) // 2))


def run_module(name: str, path: str, image_path: str):
    try:
        proc = subprocess.run(
            ["python", path, "--image", image_path],
            capture_output=True,
            text=True,
            timeout=5,
        )
        if proc.returncode != 0 or not (proc.stdout or "").strip():
            return (
                {"error": "nonzero exit or no output"},
                f"{name}: nonzero exit or no output",
            )

        try:
            data = json.loads(proc.stdout)
            if not isinstance(data, dict):
                return (
                    {"error": "invalid json (not an object)"},
                    f"{name}: invalid json (not an object)",
                )
            return data, None
        except Exception:
            return ({"error": "invalid json"}, f"{name}: invalid json")

    except subprocess.TimeoutExpired:
        return ({"error": "timeout"}, f"{name}: timeout")
    except Exception as e:
        return ({"error": str(e)}, f"{name}: {str(e)}")


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


def main():
    try:
        if "--image" not in sys.argv:
            raise Exception("Missing --image argument")

        image_path = sys.argv[sys.argv.index("--image") + 1]

        if not os.path.exists(image_path):
            raise Exception("Image not found")

        fp = _fingerprint(image_path)

        results = {}
        errors = []

        with concurrent.futures.ThreadPoolExecutor() as executor:
            futs = {
                name: executor.submit(run_module, name, path, image_path)
                for name, (path, _) in MODULES.items()
            }

            for name, future in futs.items():
                data, err = future.result()
                results[name] = data
                if err:
                    errors.append(err)

        mano_ok = extract_ok_flag("mano", results.get("mano", {}))
        time_ok = extract_ok_flag("time", results.get("time", {}))
        board_preflop_ok = extract_ok_flag("board_state", results.get("board_state", {}))

        preflop_ok = bool(mano_ok and time_ok and board_preflop_ok)

        out = {
            "preflop_ok": preflop_ok,
            "fingerprint": fp,
            "modules": results,
            "errors": errors,
        }
        print(json.dumps(out))
        return

    except Exception as e:
        try:
            image_path = sys.argv[sys.argv.index("--image") + 1] if "--image" in sys.argv else ""
        except Exception:
            image_path = ""

        fp = _fingerprint(image_path)
        msg = str(e)

        out = {
            "preflop_ok": False,
            "fingerprint": fp,
            "modules": {
                "mano": {"error": msg, "mano_ok": False},
                "time": {"error": msg, "time_ok": False},
                "board_state": {"error": msg, "street_state": "unknown", "valid_count": 0},
            },
            "errors": [msg],
        }
        print(json.dumps(out))
        return


if __name__ == "__main__":
    main()
