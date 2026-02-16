# C:\Users\Usuario\Desktop\proyectos\musica_new\modules\preflop\preflop.py
import sys
import os
import json
import time as t
import hashlib
import concurrent.futures
import subprocess

MANO_PATH = os.path.join(os.path.dirname(__file__), "mano.py")
TIME_PATH = os.path.join(os.path.dirname(__file__), "time.py")
NOBOARD_PATH = os.path.join(os.path.dirname(__file__), "noboard.py")

MODULES = {
    "mano": (MANO_PATH, "mano_ok"),
    "time": (TIME_PATH, "time_ok"),
    "noboard": (NOBOARD_PATH, "noboard_ok"),
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
                {"error": "nonzero exit or no output", MODULES[name][1]: False},
                f"{name}: nonzero exit or no output",
            )

        try:
            data = json.loads(proc.stdout)
            if not isinstance(data, dict):
                return (
                    {"error": "invalid json (not an object)", MODULES[name][1]: False},
                    f"{name}: invalid json (not an object)",
                )
            return data, None
        except Exception:
            return ({"error": "invalid json", MODULES[name][1]: False}, f"{name}: invalid json")

    except subprocess.TimeoutExpired:
        return ({"error": "timeout", MODULES[name][1]: False}, f"{name}: timeout")
    except Exception as e:
        return ({"error": str(e), MODULES[name][1]: False}, f"{name}: {str(e)}")


def extract_ok_flag(name: str, data: dict) -> bool:
    if name == "mano":
        if isinstance(data, dict):
            hand_class = data.get("hand_class", "")
            mano_raw = data.get("mano_raw", "")
            return bool(hand_class and mano_raw)
        return False

    key = MODULES[name][1]
    return bool(isinstance(data, dict) and data.get(key, False))


def main():
    try:
        if "--image" not in sys.argv:
            raise Exception("Missing --image argument")

        image_path = sys.argv[sys.argv.index("--image") + 1]

        # ✅ FIX: si la imagen no existe, error global (y errors no vacío)
        if not os.path.exists(image_path):
            raise Exception("Image not found")

        fp = _fingerprint(image_path)

        results = {}
        errors = []

        with concurrent.futures.ThreadPoolExecutor() as executor:
            futs = {name: executor.submit(run_module, name, path, image_path) for name, (path, _) in MODULES.items()}

            # ✅ FIX: iteración correcta
            for name, future in futs.items():
                data, err = future.result()
                results[name] = data
                if err:
                    errors.append(err)

        mano_ok = extract_ok_flag("mano", results.get("mano", {}))
        time_ok = extract_ok_flag("time", results.get("time", {}))
        noboard_ok = extract_ok_flag("noboard", results.get("noboard", {}))

        preflop_ok = bool(mano_ok and time_ok and noboard_ok)

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
                "noboard": {"error": msg, "noboard_ok": False},
            },
            "errors": [msg],
        }
        print(json.dumps(out))
        return


if __name__ == "__main__":
    main()
