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
    ap.add_argument("--max_ticks", type=int, default=None)
    ap.add_argument("--verbose", action="store_true")
    args = ap.parse_args()

    ensure_dirs(os.path.abspath(args.out_dir))

    run_loop(
        out_dir=args.out_dir,
        interval_ms=args.interval_ms,
        verbose=args.verbose,
        fp=sys.stdout,
        max_ticks=args.max_ticks,
    )


if __name__ == "__main__":
    main()
