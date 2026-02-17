# OCR-based villano classification using player names and SQLite DB
# Follows the style of other OCR modules and uses repo DB helpers

from __future__ import annotations
import os
import json
from typing import Dict, Any
from modules.ocr import names as ocr_names
from modules.db import db as dbmod

def ensure_players_table(conn):
    # Defensive: ensure table exists (idempotent)
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS players (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            tipo TEXT NOT NULL DEFAULT 'fish',
            created_at TEXT DEFAULT (datetime('now'))
        )
        """
    )


def classify_villano(image_path: str, x1: int = 0, y1: int = 0) -> Dict[str, Any]:
    out = {
        "ok": False,
        "p2": {"name": "", "tipo": ""},
        "p3": {"name": "", "tipo": ""},
        "created": [],
        "errors": [],
    }
    names = ocr_names.read_names(image_path, x1=x1, y1=y1)
    p2_name = names.get("p2_name", "") or ""
    p3_name = names.get("p3_name", "") or ""
    conn = dbmod.get_conn()
    ensure_players_table(conn)
    for seat, name in (("p2", p2_name), ("p3", p3_name)):
        if name:
            row = conn.execute("SELECT tipo FROM players WHERE name=?", (name,)).fetchone()
            if row is not None:
                out[seat] = {"name": name, "tipo": row[0]}
            else:
                conn.execute("INSERT INTO players (name, tipo) VALUES (?, 'fish')", (name,))
                out[seat] = {"name": name, "tipo": "fish"}
                out["created"].append(seat)
    conn.commit()
    out["ok"] = bool(p2_name or p3_name)
    if not out["ok"]:
        out["errors"].append("no_valid_names")
    return out

if __name__ == "__main__":
    import sys
    image_path = None
    if "--image" in sys.argv:
        try:
            image_path = sys.argv[sys.argv.index("--image") + 1]
        except Exception:
            image_path = None
    res = classify_villano(image_path) if image_path else {"ok": False, "errors": ["no_image"]}
    print(json.dumps({
        "ok": res.get("ok", False),
        "p2": res.get("p2", {}),
        "p3": res.get("p3", {}),
        "created": res.get("created", []),
        "errors": res.get("errors", []),
    }, ensure_ascii=False))
