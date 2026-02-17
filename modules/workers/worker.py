# C:\Users\Usuario\Desktop\proyectos\musica_new\modules\workers\worker.py
import sys
import os

# Ensure repo root is on sys.path when running as a script (tests call python modules/workers/worker.py ...)
_REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if _REPO_ROOT not in sys.path:
    sys.path.insert(0, _REPO_ROOT)

import json
import time
import hashlib
import argparse
import tempfile
import subprocess


def parse_args():
    p = argparse.ArgumentParser()
    p.add_argument("--id", type=int, required=True)
    p.add_argument("--interval_ms", type=int, default=200)
    p.add_argument("--image", type=str, default=None)
    p.add_argument("--region", nargs=4, type=int, default=None)
    p.add_argument("--max_ticks", type=int, default=None)  # solo para tests/dev
    p.add_argument("--print_every_tick", type=str, default="true")
    return p.parse_args()


def _sha1(s: str) -> str:
    return hashlib.sha1(s.encode("utf-8", errors="ignore")).hexdigest()


def get_fingerprint(worker_id: int, mode: str, image_or_region: str) -> str:
    bucket = int(time.time()) // 2
    return _sha1(f"{worker_id}|{mode}|{image_or_region}|{bucket}")


def run_preflop(image_path: str) -> dict:
    preflop_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../preflop/preflop.py"))
    try:
        proc = subprocess.run(
            [sys.executable, preflop_path, "--image", image_path],
            capture_output=True,
            text=True,
            timeout=10,
        )
        if proc.returncode != 0 or not (proc.stdout or "").strip():
            return {"error": "preflop failed", "preflop_ok": False}
        try:
            data = json.loads(proc.stdout)
            if isinstance(data, dict):
                return data
            return {"error": "preflop invalid json (not object)", "preflop_ok": False}
        except Exception:
            return {"error": "preflop invalid json", "preflop_ok": False}
    except Exception as e:
        return {"error": str(e), "preflop_ok": False}


def safe_capture(region):
    try:
        from PIL import ImageGrab  # type: ignore

        x, y, w, h = region
        img = ImageGrab.grab(bbox=(x, y, x + w, y + h))
        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".png")
        img.save(tmp.name)
        return tmp.name, None
    except Exception as e:
        return None, str(e)


def main():

    args = parse_args()
    worker_id = args.id
    interval_ms = args.interval_ms
    image_path = args.image
    region = args.region
    max_ticks = args.max_ticks
    print_every_tick = (args.print_every_tick or "").lower() == "true"

    mode = "replay" if image_path else "screen"
    tick = 0

    # Dedupe state: last hand signature
    last_hand_sig = None

    # DB integration
    from modules.db import db as dbmod

    try:
        while True:
            tick += 1
            ts = time.time()
            errors = []
            img_path = None

            if mode == "replay":
                img_path = image_path
                image_or_region = os.path.abspath(img_path) if img_path else "missing"

                if not img_path or not os.path.exists(img_path):
                    errors.append("replay image not found")
                    img_path = None

            else:
                if region is None or len(region) != 4:
                    errors.append("region required for screen mode")
                    image_or_region = "missing"
                    img_path = None
                else:
                    image_or_region = f"{region[0]},{region[1]},{region[2]},{region[3]}"
                    img_path, err = safe_capture(region)
                    if err:
                        errors.append(f"capture failed: {err}")
                        img_path = None

            preflop = run_preflop(img_path) if img_path else {"error": "no image", "preflop_ok": False}

            mano_result = {"valid": False, "mano_raw": None}
            stacks_result = {"p1": None}
            if isinstance(preflop, dict):
                mods = preflop.get("modules")
                if isinstance(mods, dict):
                    mano_result = mods.get("mano", mano_result)
                    stacks_result = mods.get("stacks", stacks_result)

            fingerprint = get_fingerprint(worker_id, mode, image_or_region)

            dedupe_skipped = False
            dedupe_reason = None
            sig = None

            p1 = stacks_result.get("p1", 0)
            if p1 is None:
                p1 = 0

            # DEDUPE SIGNATURE: sha1(f"{mano_raw}|{p1_stack}")
            if mano_result.get("valid") and p1 > 0:
                base = f"{mano_result['mano_raw']}|{p1}"
                sig = hashlib.sha1(base.encode("utf-8")).hexdigest()
                if sig == last_hand_sig:
                    dedupe_skipped = True
                    dedupe_reason = "duplicate_hand"
                else:
                    last_hand_sig = sig
            else:
                dedupe_reason = "no_dedupe"

            out = {
                "worker_id": worker_id,
                "mode": mode,
                "tick": tick,
                "ts": ts,
                "preflop": preflop,
                "mano_result": mano_result,
                "stacks_result": stacks_result,
                "errors": errors,
                "fingerprint": fingerprint,
                "dedupe_skipped": dedupe_skipped,
                "dedupe_reason": dedupe_reason,
            }

            # --- Persist hands_obs ONLY when NEW + valid + stack>0 ---
            if (not dedupe_skipped) and mano_result.get("valid") and p1 > 0 and sig:
                ocr_json = json.dumps(
                    {
                        "mano": mano_result,
                        "stacks": stacks_result,
                        "preflop": preflop,
                    }
                )
                frame_ref = preflop.get("frame_ref", "") if isinstance(preflop, dict) else ""
                dbmod.insert_obs(
                    fingerprint=sig,
                    table_id="",
                    detected_at_ms=int(ts * 1000),
                    mano_raw=mano_result.get("mano_raw", ""),
                    hand_class=(preflop.get("hand_class", "") if isinstance(preflop, dict) else ""),
                    time_str=time.strftime("%H:%M:%S", time.localtime(ts)),
                    preflop_ok=(preflop.get("preflop_ok", False) if isinstance(preflop, dict) else False),
                    noboard_ok=(preflop.get("noboard_ok", False) if isinstance(preflop, dict) else False),
                    ocr_json=ocr_json,
                    frame_ref=frame_ref,
                )

            if print_every_tick:
                print(json.dumps(out))

            if dedupe_skipped:
                if max_ticks is not None and tick >= max_ticks:
                    break
                time.sleep(interval_ms / 1000.0)
                continue

            if mode == "screen" and img_path:
                try:
                    os.remove(img_path)
                except Exception:
                    pass

            if max_ticks is not None and tick >= max_ticks:
                break

            time.sleep(interval_ms / 1000.0)

    except KeyboardInterrupt:
        print(json.dumps({"worker_id": worker_id, "event": "shutdown", "ts": time.time()}))


if __name__ == "__main__":
    main()
