import sqlite3

db = r"C:\Users\Usuario\Desktop\proyectos\poker_boss\data\poker_boss.db"

con = sqlite3.connect(db)
con.row_factory = sqlite3.Row
cur = con.cursor()

r = cur.execute("""
SELECT *
FROM hands
ORDER BY id DESC
LIMIT 1
""").fetchone()

if not r:
    print("No hay manos")
else:
    for k in r.keys():
        print(f"{k}: {r[k]}")

con.close()
