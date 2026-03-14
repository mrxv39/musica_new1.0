# C:\Users\Usuario\Desktop\proyectos\poker_boss\modules\workers\spawn_workers.py
import sys
import os
import argparse
import subprocess


def parse_args():
    p = argparse.ArgumentParser()
    p.add_argument("--interval_ms", type=int, default=200)
    p.add_argument("--image", type=str, default=None)
    p.add_argument("--regions", type=str, default=None)  # "x,y,w,h; x,y,w,h; ..."
    p.add_argument("--max_ticks", type=int, default=None)
    return p.parse_args()


def main():
    args = parse_args()
    worker_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "worker.py"))

    procs = []

    if args.image:
        for i in range(1, 5):
            cmd = [
                sys.executable, worker_path,
                "--id", str(i),
                "--interval_ms", str(args.interval_ms),
                "--image", args.image,
            ]
            if args.max_ticks is not None:
                cmd += ["--max_ticks", str(args.max_ticks)]
            procs.append(subprocess.Popen(cmd))

    elif args.regions:
        regions = [r.strip() for r in args.regions.split(";") if r.strip()]
        if len(regions) != 4:
            print("ERROR: --regions must contain exactly 4 regions separated by ';'")
            sys.exit(2)

        for i, reg in enumerate(regions):
            vals = [int(x.strip()) for x in reg.split(",")]
            if len(vals) != 4:
                print(f"ERROR: invalid region: {reg}")
                sys.exit(2)

            cmd = [
                sys.executable, worker_path,
                "--id", str(i + 1),
                "--interval_ms", str(args.interval_ms),
                "--region",
            ] + [str(v) for v in vals]

            if args.max_ticks is not None:
                cmd += ["--max_ticks", str(args.max_ticks)]

            procs.append(subprocess.Popen(cmd))
    else:
        print("ERROR: Must provide --image or --regions")
        sys.exit(1)

    # Esperar a todos
    rc = 0
    for p in procs:
        r = p.wait()
        if r != 0:
            rc = r
    sys.exit(rc)


if __name__ == "__main__":
    main()
