# C:\Users\Usuario\Desktop\proyectos\poker_boss\modules\preflop\link_hands_real_to_spots.py

import argparse
import sqlite3

from link_spots_matching import choose_candidates_for_room, closest_spot
from link_spots_utils import (
    build_spots_by_region,
    copy_spot_to_hand_media,
    load_spots,
    parse_startdate_to_ms,
)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", required=True)
    ap.add_argument("--spots_dir", required=True)
    ap.add_argument("--window_ms", type=int, default=60000)
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--dry_run", action="store_true")
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()

    spots_all = load_spots(args.spots_dir)
    if not spots_all:
        print(f"ERROR: no spots found in {args.spots_dir}")
        return 2

    spots_by_region = build_spots_by_region(spots_all)

    print(f"spots loaded: {len(spots_all)}")
    print(f"regions found: {len(spots_by_region)}")

    con = sqlite3.connect(args.db)
    cur = con.cursor()

    cur.execute(
        "SELECT id, gamecode, room, startdate, spot_png, spot_json "
        "FROM hands_real ORDER BY id ASC"
    )
    rows = cur.fetchall()

    updated = 0
    scanned = 0
    parse_fail = 0
    no_match = 0

    for (hid, gamecode, room, startdate, spot_png, spot_json) in rows:
        scanned += 1

        if args.limit and scanned > args.limit:
            break

        if (spot_png or spot_json) and not args.force:
            continue

        t_ms = parse_startdate_to_ms(startdate)
        if t_ms is None:
            parse_fail += 1
            if parse_fail <= 8:
                print(f"[parse_fail] id={hid} room={room} startdate={startdate!r}")
            continue

        candidates = choose_candidates_for_room(room, spots_all, spots_by_region)

        sp = closest_spot(candidates, t_ms, args.window_ms)
        if not sp:
            no_match += 1
            continue

        dt = abs(sp["ts_ms"] - t_ms)

        if args.dry_run:
            from os.path import dirname, join
            hand_dir_preview = join(dirname(args.db), "hands_real_media", str(gamecode))
            print(
                f"[DRY] id={hid} gamecode={gamecode} room={room} start={startdate!r} -> "
                f"{sp['png_path']} (dt_ms={dt}) => {hand_dir_preview}"
            )
            continue

        try:
            new_png, new_json = copy_spot_to_hand_media(
                args.db,
                str(gamecode),
                sp["png_path"],
                sp["json_path"],
            )

            cur.execute(
                "UPDATE hands_real SET spot_png=?, spot_json=? WHERE id=?",
                (new_png, new_json, hid),
            )
            updated += 1
        except Exception as e:
            print(f"[copy_fail] id={hid} gamecode={gamecode} err={e}")

    if not args.dry_run:
        con.commit()

    con.close()

    print("----")
    print(f"scanned: {scanned}")
    print(f"updated: {updated} (dry_run={args.dry_run})")
    print(f"parse_fail: {parse_fail}")
    print(f"no_match: {no_match}")
    print(f"window_ms: {args.window_ms}")

    if parse_fail > 0:
        print("TIP: pega 3 ejemplos de startdate y ajusto el parser.")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
