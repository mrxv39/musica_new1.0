import sqlite3

db = r"C:\Users\Usuario\Desktop\proyectos\poker_boss\data\poker_boss.db"

con = sqlite3.connect(db)
con.row_factory = sqlite3.Row
cur = con.cursor()

rows = cur.execute("""
SELECT *
FROM workers_captures
ORDER BY capture_id DESC
LIMIT 10
""").fetchall()

for i, r in enumerate(rows, 1):
    print(f"\n===== CAPTURE {i} =====")
    for k in r.keys():
        print(f"{k}: {r[k]}")

con.close()
