# C:\Users\Usuario\Desktop\proyectos\poker_boss\modules\preflop\import_xml.py
from __future__ import annotations

import argparse
import json
import os
import sys


# Ensure repo root is on sys.path when running as a script:
#   python .\modules\preflop\import_xml.py ...
_REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if _REPO_ROOT not in sys.path:
    sys.path.insert(0, _REPO_ROOT)

from modules.importers.championpoker_xml_importer import import_xml_folder


def main() -> int:
    p = argparse.ArgumentParser(description="Import ChampionPoker XML hand histories into sqlite")
    p.add_argument("--folder", required=True, help="Folder containing .xml files (tournaments history)")
    p.add_argument("--db", required=True, help="Path to sqlite db file")
    p.add_argument("--room", default="championpoker", help="Room name (e.g. championpoker)")
    p.add_argument("--hero", required=True, help="Hero nick (e.g. xavieeee2)")
    p.add_argument("--tournament_path", default="", help="Optional grouping label (e.g. account folder)")
    p.add_argument("--no_recursive", action="store_true", help="Do not scan recursively")
    p.add_argument("--quiet", action="store_true", help="Less logs")

    args = p.parse_args()

    res = import_xml_folder(
        folder=args.folder,
        db_path=args.db,
        room=args.room,
        hero=args.hero,
        tournament_path=args.tournament_path,
        recursive=(not args.no_recursive),
        verbose=(not args.quiet),
    )
    print(json.dumps(res, ensure_ascii=False, indent=2))
    return 0 if res.get("ok") else 1


if __name__ == "__main__":
    raise SystemExit(main())