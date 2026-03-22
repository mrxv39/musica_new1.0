import sqlite3

db = r"C:\Users\Usuario\Desktop\proyectos\poker_boss\data\poker_boss.db"
con = sqlite3.connect(db)
cur = con.cursor()

rows = cur.execute("""
SELECT name
FROM sqlite_master
WHERE type='table'
ORDER BY name
""").fetchall()

for r in rows:
    print(r[0])

con.close()
