# C:\Users\Usuario\Desktop\proyectos\poker_boss\modules\preflop\preflop.py
import sys
import os
import json
import time as t
import hashlib
import concurrent.futures

try:
    from .mano import run_mano
    from .time import run_time
    from .noboard import run_noboard
except ImportError:
    # Fallback for direct script execution (python preflop.py --image ...)
    import importlib.util
    _dir = os.path.dirname(os.path.abspath(__file__))
    def _load_local(module_name, file_name):
        spec = importlib.util.spec_from_file_location(module_name, os.path.join(_dir, file_name))
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        return mod
    run_mano = _load_local("mano", "mano.py").run_mano  # type: ignore[no-redef]
    run_time = _load_local("time_module", "time.py").run_time  # type: ignore[no-redef]
    run_noboard = _load_local("noboard", "noboard.py").run_noboard  # type: ignore[no-redef]

MODULES_OK_KEY = {
    "mano": "mano_ok",
    "time": "time_ok",
    "noboard": "noboard_ok",
}

_MODULE_RUNNERS = {
    "mano": run_mano,
    "time": run_time,
    "noboard": run_noboard,
}


def _sha1(s: str) -> str:
    return hashlib.sha1(s.encode("utf-8", errors="ignore")).hexdigest()


def _fingerprint(image_path: str) -> str:
    abs_image_path = os.path.abspath(image_path or "")
    return _sha1(abs_image_path + "|preflop|" + str(int(t.time()) // 2))


def run_module(name: str, image_path: str):
    try:
        runner = _MODULE_RUNNERS[name]
        data = runner(image_path)
        if not isinstance(data, dict):
            return (
                {"error": "invalid result (not a dict)", MODULES_OK_KEY[name]: False},
                f"{name}: invalid result (not a dict)",
            )
        return data, None
    except Exception as e:
        return ({"error": str(e), MODULES_OK_KEY[name]: False}, f"{name}: {str(e)}")


def extract_ok_flag(name: str, data: dict) -> bool:
    if name == "mano":
        if isinstance(data, dict):
            hand_class = data.get("hand_class", "")
            mano_raw = data.get("mano_raw", "")
            return bool(hand_class and mano_raw)
        return False

    key = MODULES_OK_KEY[name]
    return bool(isinstance(data, dict) and data.get(key, False))


def run_preflop(image_path: str) -> dict:
    """Direct-call entry point (no subprocess). Runs all modules and returns combined result."""
    try:
        abs_image_path = os.path.abspath(image_path)
        if not os.path.exists(abs_image_path):
            raise Exception("Image not found")

        fp = _fingerprint(abs_image_path)

        results = {}
        errors = []

        with concurrent.futures.ThreadPoolExecutor() as executor:
            futs = {name: executor.submit(run_module, name, abs_image_path) for name in _MODULE_RUNNERS}
            for name, future in futs.items():
                data, err = future.result()
                results[name] = data
                if err:
                    errors.append(err)

        mano_ok = extract_ok_flag("mano", results.get("mano", {}))
        time_ok = extract_ok_flag("time", results.get("time", {}))
        noboard_ok = extract_ok_flag("noboard", results.get("noboard", {}))

        preflop_ok = bool(mano_ok and time_ok and noboard_ok)

        return {
            "preflop_ok": preflop_ok,
            "fingerprint": fp,
            "modules": results,
            "errors": errors,
        }
    except Exception as e:
        fp = _fingerprint(image_path or "")
        msg = str(e)
        return {
            "preflop_ok": False,
            "fingerprint": fp,
            "modules": {
                "mano": {"error": msg, "mano_ok": False},
                "time": {"error": msg, "time_ok": False},
                "noboard": {"error": msg, "noboard_ok": False},
            },
            "errors": [msg],
        }


def main():
    if "--image" not in sys.argv:
        out = run_preflop("")
        print(json.dumps(out))
        return
    image_path = sys.argv[sys.argv.index("--image") + 1]
    out = run_preflop(image_path)
    print(json.dumps(out))


if __name__ == "__main__":
    main()
