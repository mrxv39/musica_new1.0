import sqlite3
from pathlib import Path

for p in Path(".").rglob("*.db"):
    try:
        con = sqlite3.connect(str(p))
        cur = con.cursor()
        rows = cur.execute("""
        SELECT name
        FROM sqlite_master
        WHERE type='table' AND name='worker_captures'
        """).fetchall()
        con.close()
        if rows:
            print(p)
    except Exception:
        pass
