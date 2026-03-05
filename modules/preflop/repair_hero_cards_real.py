# C:\Users\Usuario\Desktop\proyectos\poker_boss\modules\preflop\repair_hero_cards_real.py
import argparse
import os
import sqlite3
import xml.etree.ElementTree as ET

def resolve_xml_path(tournament_path: str, source_file: str) -> str:
    tp = (tournament_path or "").strip()
    sf = (source_file or "").strip()

    # 1) si source_file ya es una ruta válida, usarla
    if sf and os.path.isabs(sf) and os.path.exists(sf):
        return sf

    # 2) si tournament_path + source_file existe
    if tp and sf:
        p = os.path.join(tp, sf)
        if os.path.exists(p):
            return p

        # 3) tournament_path + basename(source_file)
        p2 = os.path.join(tp, os.path.basename(sf))
        if os.path.exists(p2):
            return p2

    return ""

def extract_hero_pocket_cards(xml_path: str, gamecode: str, hero_name: str) -> str:
    try:
        tree = ET.parse(xml_path)
        root = tree.getroot()
    except Exception:
        return ""

    # Buscar <game gamecode="...">
    for game in root.findall(".//game"):
        if (game.get("gamecode") or "") != str(gamecode):
            continue

        # OJO: puede haber <round no="1"> ... <cards type="Pocket">
        # Lo importante: coger el que tenga player == hero_name
        hero_cards = ""
        for cards in game.findall(".//cards"):
            if (cards.get("type") or "") != "Pocket":
                continue
            if (cards.get("player") or "") != hero_name:
                continue
            txt = (cards.text or "").strip()
            if txt:
                hero_cards = txt
                break

        return hero_cards

    return ""

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", required=True)
    ap.add_argument("--room", default="")
    ap.add_argument("--hero", default="")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--limit", type=int, default=0)
    args = ap.parse_args()

    db_path = args.db
    if not os.path.exists(db_path):
        raise SystemExit(f"DB no existe: {db_path}")

    con = sqlite3.connect(db_path)
    con.row_factory = sqlite3.Row
    cur = con.cursor()

    where = ["(hero_cards IS NULL OR hero_cards='' OR hero_cards='X X' OR hero_cards='X  X' OR hero_cards='XX' OR hero_cards='X')"]
    params = []

    if args.room:
        where.append("room = ?")
        params.append(args.room)

    if args.hero:
        where.append("hero = ?")
        params.append(args.hero)

    where_sql = " AND ".join(where)
    limit_sql = f" LIMIT {int(args.limit)}" if args.limit and args.limit > 0 else ""

    cur.execute(
        f"""
        SELECT id, room, hero, tournament_path, source_file, gamecode, hero_cards
        FROM hands_real
        WHERE {where_sql}
        ORDER BY id DESC
        {limit_sql}
        """,
        params,
    )
    rows = cur.fetchall()

    fixed = 0
    missing_xml = 0
    missing_cards = 0

    for r in rows:
        hand_id = r["id"]
        room = r["room"]
        hero = r["hero"]
        tp = r["tournament_path"]
        sf = r["source_file"]
        gamecode = r["gamecode"]

        xml_path = resolve_xml_path(tp, sf)
        if not xml_path:
            missing_xml += 1
            continue

        cards = extract_hero_pocket_cards(xml_path, gamecode, hero)
        if not cards:
            missing_cards += 1
            continue

        if args.dry_run:
            print(f"[DRY] id={hand_id} gamecode={gamecode} hero={hero}  '{r['hero_cards']}' -> '{cards}'  ({os.path.basename(xml_path)})")
        else:
            cur.execute("UPDATE hands_real SET hero_cards=? WHERE id=?", (cards, hand_id))
            fixed += 1

    if not args.dry_run:
        con.commit()

    con.close()

    print("hands_checked:", len(rows))
    print("fixed:", fixed)
    print("missing_xml_path:", missing_xml)
    print("missing_hero_cards_in_xml:", missing_cards)
    if args.dry_run:
        print("dry_run: true")

if __name__ == "__main__":
    main()
