from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
from pathlib import Path


def run_cmd(args: list[str]) -> tuple[int, str, str]:
    p = subprocess.run(args, capture_output=True, text=True)
    return p.returncode, p.stdout.strip(), p.stderr.strip()


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", required=True)
    ap.add_argument("--xml-folder", required=True)
    ap.add_argument("--hero", required=True)
    ap.add_argument("--interval-sec", type=float, default=8.0)
    ap.add_argument("--quiet", action="store_true")
    args = ap.parse_args()

    db_path = str(Path(args.db).resolve())
    xml_folder = str(Path(args.xml_folder).resolve())
    hero = args.hero
    interval_sec = max(2.0, float(args.interval_sec))

    root = Path(__file__).resolve().parents[2]
    import_script = root / "modules" / "preflop" / "import_xml.py"
    match_script = root / "modules" / "preflop" / "link_hands_obs_to_spots_xml_real.py"

    if not os.path.isdir(xml_folder):
        print(json.dumps({"ok": False, "error": f"xml folder not found: {xml_folder}"}))
        sys.exit(1)

    if not args.quiet:
        print(json.dumps({
            "ok": True,
            "event": "live_xml_sync_started",
            "db": db_path,
            "xml_folder": xml_folder,
            "hero": hero,
            "interval_sec": interval_sec,
        }, ensure_ascii=False))

    while True:
        rc1, out1, err1 = run_cmd([
            sys.executable,
            str(import_script),
            "--folder", xml_folder,
            "--db", db_path,
            "--hero", hero,
            "--quiet",
        ])

        rc2, out2, err2 = run_cmd([
            sys.executable,
            str(match_script),
            "--db", db_path,
            "--quiet",
        ])

        if not args.quiet:
            print(json.dumps({
                "ok": rc1 == 0 and rc2 == 0,
                "event": "live_xml_sync_tick",
                "import_rc": rc1,
                "match_rc": rc2,
                "import_out": out1,
                "import_err": err1,
                "match_out": out2,
                "match_err": err2,
                "ts_ms": int(time.time() * 1000),
            }, ensure_ascii=False))

        time.sleep(interval_sec)


if __name__ == "__main__":
    main()
