# C:\Users\Usuario\Desktop\proyectos\poker_boss\modules\preflop\link_spots_utils.py

import glob
import json
import os
import re
import shutil
from datetime import datetime, timezone


REGION_BY_ROOM = {
    "1": (520, 210, 776, 597),
    "2": (520, 807, 776, 597),
    "3": (1296, 210, 776, 597),
    "4": (1296, 807, 776, 597),
}


def norm_room(x: str) -> str:
    if x is None:
        return ""

    s = str(x).strip().lower()
    s = s.replace("mesa", "").replace("table", "").replace("#", "").strip()
    s = re.sub(r"\s+", "", s)

    if s.isdigit():
        return str(int(s))

    m = re.search(r"(\d+)", s)
    if m:
        return str(int(m.group(1)))

    return ""


def parse_startdate_to_ms(s: str):
    if s is None:
        return None

    s = str(s).strip()
    if not s:
        return None

    if re.fullmatch(r"\d{10,13}", s):
        n = int(s)
        if n > 10_000_000_000:
            return n
        return n * 1000

    fmts = [
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d %H:%M:%S.%f",
        "%Y/%m/%d %H:%M:%S",
        "%Y/%m/%d %H:%M:%S.%f",
        "%d/%m/%Y %H:%M:%S",
        "%d/%m/%Y %H:%M:%S.%f",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%dT%H:%M:%S.%f",
        "%Y-%m-%dT%H:%M:%SZ",
        "%Y-%m-%dT%H:%M:%S.%fZ",
    ]

    for fmt in fmts:
        try:
            dt = datetime.strptime(s, fmt)
            if s.endswith("Z"):
                dt = dt.replace(tzinfo=timezone.utc)
                return int(dt.timestamp() * 1000)
            return int(dt.timestamp() * 1000)
        except Exception:
            pass

    return None


def load_spots(spots_dir: str):
    items = []

    for jp in glob.glob(os.path.join(spots_dir, "**", "spot_*.json"), recursive=True):
        try:
            with open(jp, "r", encoding="utf-8") as f:
                j = json.load(f)

            ts = j.get("ts_ms")
            saved = j.get("saved_path")
            region = j.get("region")

            if not isinstance(ts, int):
                continue

            if not isinstance(saved, str) or not saved:
                continue

            reg = None
            if isinstance(region, list) and len(region) == 4:
                reg = tuple(region)

            items.append(
                {
                    "ts_ms": ts,
                    "json_path": jp,
                    "png_path": saved,
                    "region": reg,
                    "spot_hash": j.get("spot_hash", ""),
                }
            )
        except Exception:
            continue

    items.sort(key=lambda x: x["ts_ms"])
    return items


def build_spots_by_region(spots_all):
    spots_by_region = {}

    for sp in spots_all:
        reg = sp["region"]
        if reg is None:
            continue
        spots_by_region.setdefault(reg, []).append(sp)

    return spots_by_region


def ensure_dir(path: str):
    os.makedirs(path, exist_ok=True)


def safe_remove(path: str):
    try:
        if os.path.exists(path):
            os.remove(path)
    except Exception:
        pass


def sanitize_folder_name(value: str) -> str:
    s = str(value or "").strip()
    if not s:
        return "unknown_gamecode"

    s = re.sub(r'[<>:"/\\|?*]+', "_", s)
    s = re.sub(r"\s+", "_", s)
    s = s.strip("._ ")
    return s or "unknown_gamecode"


def copy_spot_to_hand_media(db_path: str, gamecode: str, src_png: str, src_json: str):
    data_dir = os.path.dirname(db_path)
    media_root = os.path.join(data_dir, "hands_media")
    hand_dir = os.path.join(media_root, sanitize_folder_name(gamecode))

    ensure_dir(media_root)
    ensure_dir(hand_dir)

    dst_png = os.path.join(hand_dir, "spot.png")
    dst_json = os.path.join(hand_dir, "spot.json")

    safe_remove(dst_png)
    safe_remove(dst_json)

    shutil.copy2(src_png, dst_png)
    shutil.copy2(src_json, dst_json)

    return dst_png, dst_json
