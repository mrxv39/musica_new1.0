# C:\Users\Usuario\Desktop\proyectos\poker_boss\modules\preflop\run_workers_loop.py
from __future__ import annotations

import os
import sys
import argparse

# CRITICAL: when executed as a script (Tauri), cwd may not be project root.
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from modules.preflop.workers_loop.fs_utils import ensure_dirs
from modules.preflop.workers_loop.loop_runner import run_loop


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out_dir", required=True)
    ap.add_argument("--interval_ms", type=int, default=800)
    ap.add_argument("--verbose", action="store_true")
    args = ap.parse_args()

    base_dir = os.path.abspath(args.out_dir)
    dirs = ensure_dirs(base_dir)

    with open(dirs.log_path, "a", encoding="utf-8") as fp:
        run_loop(out_dir=base_dir, interval_ms=int(args.interval_ms), verbose=bool(args.verbose), fp=fp)


if __name__ == "__main__":
    main()
