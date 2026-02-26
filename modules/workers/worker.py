# C:\Users\Usuario\Desktop\proyectos\poker_boss\modules\workers\worker.py
import sys
import os

# Ensure repo root is on sys.path when running as a script (tests call python modules/workers/worker.py ...)
_REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if _REPO_ROOT not in sys.path:
    sys.path.insert(0, _REPO_ROOT)

import argparse

from modules.workers.worker_loop import run_loop

# --------------------------------------------------------------------------------------
# Compat: older tests patch modules.workers.worker.run_preflop
# After refactor, run_preflop lives in worker_preflop.
# Re-export here to keep patch path stable.
# --------------------------------------------------------------------------------------
from modules.workers.worker_preflop import run_preflop  # noqa: F401


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


def main():
    args = parse_args()
    run_loop(args)


if __name__ == "__main__":
    main()
