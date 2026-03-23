# C:\Users\Usuario\Desktop\proyectos\poker_boss\modules\workers\worker_capture_time_spots.py
from __future__ import annotations

import argparse
import hashlib
import json
import time
from collections import deque
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Deque, Dict, Optional, Tuple

import numpy as np

try:
    import mss
except Exception as e:
    raise RuntimeError("Missing dependency: mss (pip install mss)") from e

try:
    import cv2
except Exception as e:
    raise RuntimeError("Missing dependency: opencv-python (pip install opencv-python)") from e


def parse_region(s: str) -> Tuple[int, int, int, int]:
    parts = [p.strip() for p in s.split(",")]
    if len(parts) != 4:
        raise argparse.ArgumentTypeError('region must be "x,y,w,h"')
    x, y, w, h = map(int, parts)
    if w <= 0 or h <= 0:
        raise argparse.ArgumentTypeError("w and h must be > 0")
    return x, y, w, h


def now_datestr() -> str:
    return datetime.now().strftime("%Y%m%d")


def now_timestr() -> str:
    return datetime.now().strftime("%H%M%S")


def epoch_ms() -> int:
    return int(time.time() * 1000)


def sha1_bytes(b: bytes) -> str:
    return hashlib.sha1(b).hexdigest()


def center_crop(img: np.ndarray, ratio: float) -> np.ndarray:
    if ratio >= 0.999:
        return img
    h, w = img.shape[:2]
    ch = max(1, int(h * ratio))
    cw = max(1, int(w * ratio))
    y0 = (h - ch) // 2
    x0 = (w - cw) // 2
    return img[y0 : y0 + ch, x0 : x0 + cw]


def frame_quality_ok(bgr: np.ndarray) -> Tuple[bool, Dict[str, Any]]:
    """Filtro anti-basura: evita capturas casi negras/blancas o sin señal."""
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    mean = float(np.mean(gray))
    std = float(np.std(gray))
    # Umbrales conservadores: ajusta si tu mesa es muy oscura o muy clara.
    ok = (mean > 5.0) and (mean < 250.0) and (std > 2.0)
    return ok, {"mean": mean, "std": std}


@dataclass
class State:
    last_saved_spot_hash: Optional[str] = None
    last_saved_ms: int = 0
    last_seen_spot_hash: Optional[str] = None
    stable_count: int = 0


def capture_region(m: "mss.mss", region: Tuple[int, int, int, int]) -> np.ndarray:
    x, y, w, h = region
    mon = {"left": x, "top": y, "width": w, "height": h}
    frame = np.array(m.grab(mon))  # BGRA
    bgr = frame[:, :, :3]  # drop alpha
    return bgr


def should_save(
    st: State,
    *,
    spot_hash: str,
    stable_frames: int,
    min_gap_s: float,
) -> Tuple[bool, bool]:
    """
    Guardar cuando:
    - el spot se mantiene estable stable_frames ticks
    - el spot_hash es distinto del último guardado (dedupe hasta cambio)
    - ha pasado min_gap_s desde el último guardado (anti-spam)
    """
    now = epoch_ms()
    time_ok = (now - st.last_saved_ms) >= int(min_gap_s * 1000)

    if st.last_seen_spot_hash != spot_hash:
        st.last_seen_spot_hash = spot_hash
        st.stable_count = 1
    else:
        st.stable_count += 1

    stable_ok = st.stable_count >= stable_frames
    changed_vs_saved = (st.last_saved_spot_hash is None) or (spot_hash != st.last_saved_spot_hash)

    save_now = stable_ok and changed_vs_saved and time_ok
    return save_now, time_ok


def write_sidecar(path_png: Path, payload: Dict[str, Any]) -> None:
    path_json = path_png.with_suffix(".json")
    path_json.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def main() -> int:
    p = argparse.ArgumentParser(description="Capture spot PNGs (screen) - stable, dedupe until change")
    p.add_argument("--out-dir", required=True, help="Output folder")
    p.add_argument("--region", required=True, type=parse_region, help='Screen region "x,y,w,h"')
    p.add_argument("--interval-ms", type=int, default=200, help="Capture interval in ms")
    p.add_argument("--max-ticks", type=int, default=0, help="Stop after N ticks (0 = infinite)")
    p.add_argument("--dedupe-window-s", type=float, default=0.0,
                   help="(compat) previously used; now treated as min-gap-s (seconds between saves)")
    p.add_argument("--min-gap-s", type=float, default=None,
                   help="Minimum seconds between saves (overrides --dedupe-window-s if set)")
    p.add_argument("--center-crop-ratio", type=float, default=0.6,
                   help="Crop center ratio to reduce noise (0.6 default)")
    p.add_argument("--stable-frames", type=int, default=3,
                   help="Require N stable frames (same spot_hash) before saving")
    p.add_argument("--min-bytes", type=int, default=8_000,
                   help="Skip if encoded PNG is too small (anti-garbage)")
    p.add_argument("--print-every", type=int, default=25, help="Print every N ticks")

    args = p.parse_args()

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    region = args.region
    interval_s = max(1, args.interval_ms) / 1000.0
    min_gap_s = args.dedupe_window_s if args.min_gap_s is None else float(args.min_gap_s)

    st = State()

    print(json.dumps({
        "ok": True,
        "event": "start",
        "mode": "screen",
        "out_dir": str(out_dir),
        "region": list(region),
        "interval_ms": args.interval_ms,
        "min_gap_s": min_gap_s,
        "stable_frames": args.stable_frames,
        "center_crop_ratio": args.center_crop_ratio,
    }, ensure_ascii=False))

    ticks = 0
    saved = 0

    with mss.mss() as m:
        try:
            while True:
                ticks += 1

                bgr_full = capture_region(m, region)
                bgr = center_crop(bgr_full, float(args.center_crop_ratio))

                ok_q, q = frame_quality_ok(bgr)
                if not ok_q:
                    if (ticks % args.print_every) == 0:
                        print(json.dumps({
                            "ok": True, "event": "tick", "ticks": ticks, "saved": saved,
                            "skipped_reason": "bad_frame", "quality": q
                        }, ensure_ascii=False))
                    if args.max_ticks and ticks >= args.max_ticks:
                        break
                    time.sleep(interval_s)
                    continue

                ok_enc, png_buf = cv2.imencode(".png", bgr)
                if not ok_enc:
                    raise RuntimeError("cv2.imencode failed")

                png_bytes = png_buf.tobytes()
                if len(png_bytes) < int(args.min_bytes):
                    if (ticks % args.print_every) == 0:
                        print(json.dumps({
                            "ok": True, "event": "tick", "ticks": ticks, "saved": saved,
                            "skipped_reason": "too_small_png", "bytes": len(png_bytes), "quality": q
                        }, ensure_ascii=False))
                    if args.max_ticks and ticks >= args.max_ticks:
                        break
                    time.sleep(interval_s)
                    continue

                spot_hash = sha1_bytes(png_bytes)

                save_now, time_ok = should_save(
                    st,
                    spot_hash=spot_hash,
                    stable_frames=int(args.stable_frames),
                    min_gap_s=float(min_gap_s),
                )

                saved_path = None
                skipped_reason = None

                if save_now:
                    fname = f"spot_{now_datestr()}_{now_timestr()}_{epoch_ms()}_sha{spot_hash[:8]}.png"
                    path_png = out_dir / fname
                    path_png.write_bytes(png_bytes)
                    saved += 1
                    saved_path = str(path_png)

                    sidecar = {
                        "spot_hash": spot_hash,
                        "region": list(region),
                        "saved_path": saved_path,
                        "ts_ms": epoch_ms(),
                        "quality": q,
                        "center_crop_ratio": args.center_crop_ratio,
                        "stable_frames": args.stable_frames,
                        "stable_count": st.stable_count,
                    }
                    write_sidecar(path_png, sidecar)

                    st.last_saved_spot_hash = spot_hash
                    st.last_saved_ms = epoch_ms()
                else:
                    if not time_ok:
                        skipped_reason = "min_gap"
                    else:
                        # estable? o mismo spot ya guardado?
                        if st.stable_count < int(args.stable_frames):
                            skipped_reason = "not_stable_yet"
                        elif st.last_saved_spot_hash == spot_hash:
                            skipped_reason = "same_spot_hash"
                        else:
                            skipped_reason = "unknown_skip"

                if (ticks % args.print_every) == 0 or save_now:
                    print(json.dumps({
                        "ok": True,
                        "event": "tick",
                        "ticks": ticks,
                        "saved": saved,
                        "time_ok": time_ok,
                        "stable": st.stable_count,
                        "spot_hash": spot_hash,
                        "saved_path": saved_path,
                        "skipped_reason": None if save_now else skipped_reason,
                        "quality": q,
                    }, ensure_ascii=False))

                if args.max_ticks and ticks >= args.max_ticks:
                    break

                time.sleep(interval_s)

        except KeyboardInterrupt:
            print(json.dumps({"ok": True, "event": "ctrl_c", "ticks": ticks, "saved": saved}, ensure_ascii=False))
            return 0

    print(json.dumps({"ok": True, "event": "done", "ticks": ticks, "saved": saved}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
