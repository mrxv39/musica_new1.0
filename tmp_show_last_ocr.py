import sqlite3, json

db = r"C:\Users\Usuario\Desktop\proyectos\poker_boss\data\poker_boss.db"

con = sqlite3.connect(db)
cur = con.cursor()

row = cur.execute("""
SELECT capture_id, ocr_json
FROM worker_captures
ORDER BY capture_id DESC
LIMIT 1
""").fetchone()

if not row:
    print("No hay capturas")
else:
    print("capture_id:", row[0])
    try:
        obj = json.loads(row[1] or "{}")
        print(json.dumps(obj, indent=2, ensure_ascii=False))
    except Exception as e:
        print("No se pudo parsear ocr_json:", e)
        print(row[1])

con.close()
