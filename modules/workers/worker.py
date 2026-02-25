# C:\Users\Usuario\Desktop\proyectos\poker_boss\modules\workers\worker.py
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

    # Replay (single image)
    p.add_argument("--image", type=str, default=None)

    # Replay (folder of images)
    p.add_argument("--images_dir", type=str, default=None)
    p.add_argument("--loop", type=str, default="false")  # true/false

    # Screen mode
    p.add_argument("--region", nargs=4, type=int, default=None)

    # Persist mode
    p.add_argument("--persist_without_stack", type=str, default="false")  # true/false

    # Tests/dev
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


def _list_images_in_dir(images_dir: str):
    # Only bmp + png, sorted by filename
    exts = {".bmp", ".png"}
    try:
        names = os.listdir(images_dir)
    except Exception:
        return []

    files = []
    for n in names:
        p = os.path.join(images_dir, n)
        if not os.path.isfile(p):
            continue
        _, ext = os.path.splitext(n)
        if ext.lower() in exts:
            files.append(p)

    files.sort(key=lambda x: os.path.basename(x).lower())
    return files


def _nested_get(d, keys, default=None):
    cur = d
    for k in keys:
        if not isinstance(cur, dict):
            return default
        cur = cur.get(k)
    return cur if cur is not None else default


def main():
    args = parse_args()
    worker_id = args.id
    interval_ms = args.interval_ms
    image_path = args.image
    images_dir = args.images_dir
    loop = (args.loop or "").lower() == "true"
    region = args.region
    max_ticks = args.max_ticks
    print_every_tick = (args.print_every_tick or "").lower() == "true"
    persist_without_stack = (args.persist_without_stack or "").lower() == "true"

    # Mode selection:
    # - replay_dir if images_dir provided
    # - replay if image provided
    # - screen otherwise
    mode = "screen"
    if images_dir:
        mode = "replay_dir"
    elif image_path:
        mode = "replay"

    tick = 0

    # Dedupe state: last hand signature
    last_hand_sig = None

    # DB integration
    from modules.db import db as dbmod

    # OCR orchestrator
    from modules.ocr.ocr import run_ocr

    # replay_dir state
    dir_files = []
    dir_idx = 0
    if mode == "replay_dir":
        images_dir = os.path.abspath(images_dir)
        dir_files = _list_images_in_dir(images_dir)

    try:
        while True:
            tick += 1
            ts = time.time()
            errors = []
            img_path = None
            image_or_region = "missing"

            if mode == "replay":
                img_path = image_path
                image_or_region = os.path.abspath(img_path) if img_path else "missing"

                if not img_path or not os.path.exists(img_path):
                    errors.append("replay image not found")
                    img_path = None

            elif mode == "replay_dir":
                if not images_dir or not os.path.isdir(images_dir):
                    errors.append("images_dir not found")
                    img_path = None
                    image_or_region = images_dir or "missing"
                else:
                    if not dir_files:
                        dir_files = _list_images_in_dir(images_dir)

                    if not dir_files:
                        errors.append("images_dir empty (no .bmp/.png)")
                        img_path = None
                        image_or_region = images_dir
                    else:
                        if dir_idx >= len(dir_files):
                            if loop:
                                dir_idx = 0
                            else:
                                break

                        img_path = dir_files[dir_idx]
                        dir_idx += 1
                        image_or_region = img_path

                        if not os.path.exists(img_path):
                            errors.append("image missing in dir")
                            img_path = None

            else:
                # screen mode
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

            # --- OCR completo (stacks/bets/stackefectivo/names/villano) ---
            ocr = {"ok": False, "errors": ["no_image"], "names": {}, "villano": {}, "stackefectivo": {}, "bets": {}, "stacks": {}}
            if img_path:
                try:
                    ocr = run_ocr(img_path)
                except Exception as e:
                    ocr = {"ok": False, "errors": [f"run_ocr:{e}"], "names": {}, "villano": {}, "stackefectivo": {}, "bets": {}, "stacks": {}}

            mano_result = {"valid": False, "mano_raw": None}
            stacks_result = {"p1": None}  # legacy (desde preflop)
            if isinstance(preflop, dict):
                mods = preflop.get("modules")
                if isinstance(mods, dict):
                    mano_result = mods.get("mano", mano_result)
                    stacks_result = mods.get("stacks", stacks_result)

            # Preferimos stacks OCR si existe p1
            ocr_stacks = ocr.get("stacks", {}) if isinstance(ocr, dict) else {}
            bets_result = ocr.get("bets", {}) if isinstance(ocr, dict) else {}
            stackefectivo_result = ocr.get("stackefectivo", {}) if isinstance(ocr, dict) else {}
            names_result = ocr.get("names", {}) if isinstance(ocr, dict) else {}
            villano_result = ocr.get("villano", {}) if isinstance(ocr, dict) else {}

            fingerprint = get_fingerprint(worker_id, mode, image_or_region)

            dedupe_skipped = False
            dedupe_reason = None
            sig = None

            # Normalizamos p1 (fallback: OCR stacks)
            p1_raw = stacks_result.get("p1", None) if isinstance(stacks_result, dict) else None
            if p1_raw is None and isinstance(ocr_stacks, dict):
                p1_raw = ocr_stacks.get("p1", None)

            p1 = 0
            if isinstance(p1_raw, (int, float)) and p1_raw is not None:
                p1 = p1_raw
            elif p1_raw is None:
                p1 = 0

            mano_valid = bool(mano_result.get("valid"))
            can_persist = mano_valid and (p1 > 0 or persist_without_stack)

            # Dedupe:
            # - modo normal: sha1(mano_raw|p1)
            # - persist_without_stack: sha1(mano_raw)
            if can_persist:
                mano_raw = mano_result.get("mano_raw") or ""
                if persist_without_stack:
                    base = f"{mano_raw}"
                else:
                    base = f"{mano_raw}|{p1}"
                sig = hashlib.sha1(base.encode("utf-8", errors="ignore")).hexdigest()

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
                "ocr": ocr,
                "mano_result": mano_result,
                "stacks_result": stacks_result,
                "ocr_stacks": ocr_stacks,
                "bets_result": bets_result,
                "stackefectivo_result": stackefectivo_result,
                "names_result": names_result,
                "villano_result": villano_result,
                "errors": errors,
                "fingerprint": fingerprint,
                "dedupe_skipped": dedupe_skipped,
                "dedupe_reason": dedupe_reason,
                "image_ref": image_or_region,
                "persist_without_stack": persist_without_stack,
            }

            # --- Persist hands_obs if new ---
            if (not dedupe_skipped) and can_persist:
                ocr_json = json.dumps(
                    {
                        "mano": mano_result,
                        "stacks_preflop": stacks_result,
                        "ocr": ocr,
                        "preflop": preflop,
                    },
                    ensure_ascii=False,
                )

                frame_ref = preflop.get("frame_ref", "") if isinstance(preflop, dict) else ""

                # Flags correctos (noboard está anidado)
                preflop_ok = bool(preflop.get("preflop_ok", False)) if isinstance(preflop, dict) else False
                noboard_ok = bool(_nested_get(preflop, ["modules", "noboard", "noboard_ok"], False))

                # hand_class suele estar en mano_result
                hand_class = ""
                if isinstance(mano_result, dict):
                    hand_class = mano_result.get("hand_class", "") or ""

                dbmod.insert_obs(
                    fingerprint=sig,
                    table_id="",
                    detected_at_ms=int(ts * 1000),
                    mano_raw=mano_result.get("mano_raw", "") or "",
                    hand_class=hand_class,
                    time_str=time.strftime("%H:%M:%S", time.localtime(ts)),
                    preflop_ok=preflop_ok,
                    noboard_ok=noboard_ok,
                    ocr_json=ocr_json,
                    frame_ref=frame_ref,
                )

            if print_every_tick:
                print(json.dumps(out, ensure_ascii=False))

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
        print(json.dumps({"worker_id": worker_id, "event": "shutdown", "ts": time.time()}, ensure_ascii=False))


if __name__ == "__main__":
    main()
