import sqlite3

db = r"C:\Users\Usuario\Desktop\proyectos\poker_boss\data\poker_boss.db"

con = sqlite3.connect(db)
con.row_factory = sqlite3.Row
cur = con.cursor()

rows = cur.execute("""
SELECT *
FROM actions_real
ORDER BY id DESC
LIMIT 20
""").fetchall()

for i, r in enumerate(rows, 1):
    print(f"\n===== ACTION_REAL {i} =====")
    for k in r.keys():
        print(f"{k}: {r[k]}")

con.close()
