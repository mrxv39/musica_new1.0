# C:\Users\Usuario\Desktop\proyectos\poker_boss\modules\preflop\capture_test_images.py
import os
import json
import argparse
from datetime import datetime

def _load_areas(project_root: str):
    cfg_path = os.path.join(project_root, "modules", "preflop", "capture_regions.json")
    if not os.path.isfile(cfg_path):
        raise RuntimeError(f"Missing regions config: {cfg_path}")

    with open(cfg_path, "r", encoding="utf-8") as f:
        cfg = json.load(f)

    areas = cfg.get("areas") or []
    if not isinstance(areas, list) or len(areas) == 0:
        raise RuntimeError("capture_regions.json must contain a non-empty 'areas' list")

    parsed = []
    for a in areas:
        mesa = int(a.get("mesa"))
        x1 = int(a.get("x1"))
        y1 = int(a.get("y1"))
        x2 = int(a.get("x2"))
        y2 = int(a.get("y2"))

        if x2 <= x1 or y2 <= y1:
            raise RuntimeError(f"Invalid area for mesa {mesa}: x2>x1 and y2>y1 required")

        parsed.append((mesa, x1, y1, x2, y2))

    return parsed

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--out_dir", required=True, help="Folder where .bmp captures will be saved")
    args = p.parse_args()

    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    out_dir = os.path.abspath(args.out_dir)
    os.makedirs(out_dir, exist_ok=True)

    try:
        from PIL import ImageGrab  # type: ignore
    except Exception as e:
        raise RuntimeError(f"Pillow not available (PIL). Install pillow. Error: {e}")

    areas = _load_areas(project_root)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")

    saved = []
    for mesa, x1, y1, x2, y2 in areas:
        bbox = (x1, y1, x2, y2)
        img = ImageGrab.grab(bbox=bbox).convert("RGB")

        filename = f"{ts}__mesa_{mesa}.bmp"
        path = os.path.join(out_dir, filename)
        img.save(path, format="BMP")
        saved.append(path)

    print("OK: captured areas ->")
    for pth in saved:
        print(pth)

if __name__ == "__main__":
    main()
