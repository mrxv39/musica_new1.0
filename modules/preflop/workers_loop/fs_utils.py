# C:\Users\Usuario\Desktop\proyectos\poker_boss\modules\preflop\workers_loop\fs_utils.py
from __future__ import annotations

import os
from dataclasses import dataclass
from datetime import datetime
from typing import TextIO

NO_OK_DIR_NAME = "no ok"


@dataclass(frozen=True)
class LoopDirs:
    ok_dir: str
    err_dir: str
    del_dir: str
    tmp_dir: str
    log_path: str


def ensure_dirs(base_dir: str) -> LoopDirs:
    ok_dir = os.path.join(base_dir, "ok")
    err_dir = os.path.join(base_dir, NO_OK_DIR_NAME)
    del_dir = os.path.join(base_dir, NO_OK_DIR_NAME)
    tmp_dir = os.path.join(base_dir, "_tmp")
    log_dir = os.path.join(base_dir, "_logs")

    os.makedirs(ok_dir, exist_ok=True)
    os.makedirs(err_dir, exist_ok=True)
    os.makedirs(tmp_dir, exist_ok=True)
    os.makedirs(log_dir, exist_ok=True)

    return LoopDirs(
        ok_dir=ok_dir,
        err_dir=err_dir,
        del_dir=del_dir,
        tmp_dir=tmp_dir,
        log_path=os.path.join(log_dir, "run_workers_loop.log"),
    )


def log(fp: TextIO, msg: str) -> None:
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
    fp.write(f"[{ts}] {msg}\n")
    fp.flush()


def safe_move(src_path: str, dst_dir: str) -> str:
    os.makedirs(dst_dir, exist_ok=True)
    base = os.path.basename(src_path)
    dst = os.path.join(dst_dir, base)

    if not os.path.exists(dst):
        os.replace(src_path, dst)
        return dst

    root, ext = os.path.splitext(base)
    k = 1
    while True:
        cand = os.path.join(dst_dir, f"{root}__{k}{ext}")
        if not os.path.exists(cand):
            os.replace(src_path, cand)
            return cand
        k += 1
