# C:\Users\Usuario\Desktop\proyectos\poker_boss\modules\workers\worker_utils.py
import os
import json
import time
import hashlib
import tempfile
from typing import Any, Dict, List, Optional, Tuple


def sha1_text(s: str) -> str:
    return hashlib.sha1(s.encode("utf-8", errors="ignore")).hexdigest()


def get_fingerprint(worker_id: int, mode: str, image_or_region: str) -> str:
    # same semantics as before (time bucket)
    bucket = int(time.time()) // 2
    return sha1_text(f"{worker_id}|{mode}|{image_or_region}|{bucket}")


def get_file_fingerprint(file_path: str) -> str:
    """SHA1 hash of file contents."""
    h = hashlib.sha1()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()


def safe_capture(region: Optional[List[int]] = None) -> Tuple[Optional[str], Optional[str]]:
    try:
        from PIL import ImageGrab  # type: ignore

        if region:
            x, y, w, h = region
            img = ImageGrab.grab(bbox=(x, y, x + w, y + h))
        else:
            img = ImageGrab.grab()
        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".png")
        img.save(tmp.name)
        return tmp.name, None
    except Exception as e:
        return None, str(e)


def list_images_in_dir(images_dir: str) -> List[str]:
    exts = {".bmp", ".png"}
    try:
        names = os.listdir(images_dir)
    except Exception:
        return []

    files: List[str] = []
    for n in names:
        p = os.path.join(images_dir, n)
        if not os.path.isfile(p):
            continue
        _, ext = os.path.splitext(n)
        if ext.lower() in exts:
            files.append(p)

    files.sort(key=lambda x: os.path.basename(x).lower())
    return files


def nested_get(d: Any, keys: List[str], default: Any = None) -> Any:
    cur = d
    for k in keys:
        if not isinstance(cur, dict):
            return default
        cur = cur.get(k)
    return cur if cur is not None else default


def dumps(obj: Any) -> str:
    return json.dumps(obj, ensure_ascii=False)
