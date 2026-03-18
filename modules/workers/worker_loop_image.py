# C:\Users\Usuario\Desktop\proyectos\poker_boss\modules\workers\worker_loop_image.py
from __future__ import annotations

import os
from typing import List, Optional

from modules.workers.worker_utils import list_images_in_dir, safe_capture
from .worker_loop_types import ImageGrabResult, ReplayDirState


def select_mode(image_path: Optional[str], images_dir: Optional[str]) -> str:
    if images_dir:
        return "replay_dir"
    if image_path:
        return "replay"
    return "screen"


def safe_remove(path: Optional[str]) -> None:
    if not path:
        return
    try:
        os.remove(path)
    except Exception:
        pass


def get_image_for_tick(
    mode: str,
    *,
    image_path: Optional[str],
    images_dir: Optional[str],
    loop_dir: bool,
    region: Optional[List[int]],
    dir_state: ReplayDirState,
) -> ImageGrabResult:
    errors: List[str] = []
    cleanup_path: Optional[str] = None

    if mode == "replay":
        img_path = image_path
        image_ref = os.path.abspath(img_path) if img_path else "missing"
        if not img_path or not os.path.exists(img_path):
            return ImageGrabResult(None, image_ref, ["replay image not found"], None)
        return ImageGrabResult(img_path, image_ref, errors, None)

    if mode == "replay_dir":
        if not images_dir or not os.path.isdir(images_dir):
            return ImageGrabResult(None, (images_dir or "missing"), ["images_dir not found"], None)

        if not dir_state.files:
            dir_state.files = list_images_in_dir(images_dir)

        if not dir_state.files:
            return ImageGrabResult(None, images_dir, ["images_dir empty (no .bmp/.png)"], None)

        if dir_state.idx >= len(dir_state.files):
            if loop_dir:
                dir_state.idx = 0
            else:
                return ImageGrabResult(None, images_dir, errors, None, done=True)

        img_path = dir_state.files[dir_state.idx]
        dir_state.idx += 1

        image_ref = os.path.abspath(img_path)
        if not os.path.exists(img_path):
            return ImageGrabResult(None, image_ref, ["replay_dir image not found"], None)

        return ImageGrabResult(img_path, image_ref, errors, None)

    # screen
    try:
        cap_path, cap_error = safe_capture(region=region)
        cleanup_path = cap_path
        image_ref = "screen_region" if region else "screen"
        if cap_error:
            return ImageGrabResult(None, image_ref, [f"safe_capture:{cap_error}"], None)
        if not cap_path or not os.path.exists(cap_path):
            return ImageGrabResult(None, image_ref, ["screen capture failed"], cleanup_path)
        return ImageGrabResult(cap_path, image_ref, errors, cleanup_path)
    except Exception as e:
        return ImageGrabResult(None, "screen", [f"safe_capture:{e}"], None)
