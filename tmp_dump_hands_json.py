import sqlite3, json

db = r"C:\Users\Usuario\Desktop\proyectos\poker_boss\data\poker_boss.db"
con = sqlite3.connect(db)
con.row_factory = sqlite3.Row
cur = con.cursor()

rows = cur.execute("""
SELECT id, fingerprint, data_json, created_at_ms
FROM hands
ORDER BY id DESC
LIMIT 10
""").fetchall()

for r in rows:
    print(f"\n===== HAND id={r['id']} =====")
    print("fingerprint:", r["fingerprint"])
    print("created_at_ms:", r["created_at_ms"])
    try:
        obj = json.loads(r["data_json"] or "{}")
        print(json.dumps(obj, indent=2, ensure_ascii=False))
    except Exception:
        print(r["data_json"])

con.close()
