# link_spots_real_images_by_start.py
# NOTE: This script targeted spots_real (removed). The table "spots" is now filled by the
# worker and has image_path set at capture time. Adapt or deprecate when hands flow is decided.
import argparse
import os
import re
import sqlite3
from datetime import datetime, timedelta

RX = re.compile(r"spot_(\d{8})_(\d{6})_(\d+).*?(?:_score([0-9.]+)|score([0-9.]+))?.*\.png$", re.I)

def parse_dt(s: str):
    if s is None:
        return None
    s = str(s).strip()
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S.%f", "%Y-%m-%dT%H:%M:%S.%f"):
        try:
            return datetime.strptime(s, fmt)
        except Exception:
            pass
    return None

def yyyymmdd(d: datetime) -> str:
    return f"{d.year:04d}{d.month:02d}{d.day:02d}"

def ensure_col(con, table, col, col_type):
    cols = [r[1] for r in con.execute(f"PRAGMA table_info({table})").fetchall()]
    if col in cols:
        return
    con.execute(f"ALTER TABLE {table} ADD COLUMN {col} {col_type}")
    con.commit()

def load_pngs(day_dir: str):
    if not os.path.isdir(day_dir):
        return []
    out = []
    for name in os.listdir(day_dir):
        if not name.lower().endswith(".png"):
            continue
        m = RX.search(name)
        if not m:
            continue
        d8, t6, epoch_ms = m.group(1), m.group(2), m.group(3)
        score = m.group(4) or m.group(5)
        score = float(score) if score is not None else None
        dt = datetime.strptime(d8 + t6, "%Y%m%d%H%M%S")
        out.append({"dt": dt, "epoch_ms": int(epoch_ms), "score": score, "path": os.path.join(day_dir, name)})
    out.sort(key=lambda x: x["dt"])
    return out

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", required=True)
    ap.add_argument("--spots_base", required=True)
    ap.add_argument("--day", default="", help="YYYYMMDD; empty=derive per hand startdate")
    ap.add_argument("--search_seconds", type=int, default=90)
    ap.add_argument("--start_offset_seconds", type=int, default=0)
    args = ap.parse_args()

    con = sqlite3.connect(args.db)
    con.row_factory = sqlite3.Row

    # A1 columns (idempotent)
    ensure_col(con, "spots_real", "img_path", "TEXT")
    ensure_col(con, "spots_real", "img_epoch_ms", "INTEGER")
    ensure_col(con, "spots_real", "img_dt", "TEXT")
    ensure_col(con, "spots_real", "img_score", "REAL")

    hands = con.execute("SELECT id, startdate FROM hands_real ORDER BY id").fetchall()
    if not hands:
        print({"error": "hands_real empty"})
        return 2

    used_paths = set()
    total_spots = 0
    linked = 0
    missing = 0
    png_cache = {}

    for h in hands:
        hid = h["id"]
        start_dt = parse_dt(h["startdate"])
        if not start_dt:
            continue
        start_dt = start_dt + timedelta(seconds=args.start_offset_seconds)

        day = args.day.strip() if args.day.strip() else yyyymmdd(start_dt)
        if day not in png_cache:
            png_cache[day] = load_pngs(os.path.join(args.spots_base, day))
        pngs = png_cache[day]

        spots = con.execute(
            "SELECT id FROM spots_real WHERE hand_id=? ORDER BY round_no, action_no, id",
            (hid,),
        ).fetchall()
        if not spots:
            continue

        total_spots += len(spots)

        end_dt = start_dt + timedelta(seconds=args.search_seconds)

        # D2: take first PNGs AFTER start (no repeats)
        candidates = []
        for p in pngs:
            if p["path"] in used_paths:
                continue
            if p["dt"] < start_dt:
                continue
            if p["dt"] > end_dt:
                break
            candidates.append(p)

        # fallback: include up to 8s before start if not enough
        if len(candidates) < len(spots):
            back_lo = start_dt - timedelta(seconds=8)
            more = []
            for p in pngs:
                if p["path"] in used_paths:
                    continue
                if p["dt"] < back_lo:
                    continue
                if p["dt"] > end_dt:
                    break
                more.append(p)
            more.sort(key=lambda x: x["dt"])
            candidates = more

        for i, s in enumerate(spots):
            sid = s["id"]
            if i >= len(candidates):
                missing += 1
                continue
            p = candidates[i]
            con.execute(
                "UPDATE spots_real SET img_path=?, img_epoch_ms=?, img_dt=?, img_score=? WHERE id=?",
                (p["path"], p["epoch_ms"], p["dt"].strftime("%Y-%m-%d %H:%M:%S"), p["score"], sid),
            )
            used_paths.add(p["path"])
            linked += 1

    con.commit()

    row = con.execute("SELECT COUNT(*) FROM spots_real WHERE img_path IS NULL OR img_path=''").fetchone()
    print({
        "total_spots_real": total_spots,
        "linked": linked,
        "missing": missing,
        "spots_real_without_img_path": int(row[0]),
        "days_loaded": list(png_cache.keys()),
    })
    con.close()
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
