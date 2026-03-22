#!/usr/bin/env python3
from __future__ import annotations

import sqlite3
from datetime import datetime


def rank_key_obs(mano_raw: str | None) -> str | None:
    if not mano_raw or len(str(mano_raw)) < 4:
        return None
    s = str(mano_raw)
    r1 = s[0].upper()
    r2 = s[2].upper()
    if r1 == "1":
        r1 = "T"
    if r2 == "1":
        r2 = "T"
    return "".join(sorted([r1, r2]))


def rank_key_real(hero_cards: str | None) -> str | None:
    if not hero_cards:
        return None
    parts = str(hero_cards).split()
    if len(parts) != 2:
        return None

    def extract_rank(card: str) -> str | None:
        c = str(card).strip().upper()
        if len(c) < 2:
            return None
        rank = c[1:]
        return "T" if rank == "10" else rank

    r1 = extract_rank(parts[0])
    r2 = extract_rank(parts[1])
    if not r1 or not r2:
        return None
    return "".join(sorted([r1, r2]))


def fmt_ms(ms: int | None) -> str:
    if not ms:
        return ""
    return datetime.fromtimestamp(ms / 1000).strftime("%Y-%m-%d %H:%M:%S")


def main() -> int:
    db = r"data\poker_boss.db"
    con = sqlite3.connect(db)
    con.row_factory = sqlite3.Row
    cur = con.cursor()

    print("## Counts")
    for tbl in ("hands", "spots", "tournaments", "strategies", "players"):
        try:
            n = cur.execute(f"SELECT COUNT(*) n FROM {tbl}").fetchone()[0]
        except Exception as e:
            n = f"ERR:{e}"
        print(f"- {tbl}: {n}")

    print("\n## Linked spots")
    try:
        linked_spots = cur.execute("SELECT COUNT(*) n FROM spots WHERE hand_id IS NOT NULL").fetchone()[0]
        total_spots = cur.execute("SELECT COUNT(*) n FROM spots").fetchone()[0]
        print(f"- linked: {linked_spots}/{total_spots}")
    except Exception as e:
        print("ERR", e)

    print("\n## hands without link")
    try:
        n = cur.execute(
            """
            SELECT COUNT(*) n
            FROM hands hr
            WHERE NOT EXISTS (SELECT 1 FROM spots s WHERE s.hand_id = hr.id)
            """
        ).fetchone()[0]
        print(f"- unlinked hands: {n}")
    except Exception as e:
        print("ERR", e)

    print("\n## Rank-key agreement on linked hands (proxy for OCR cards)")
    try:
        linked = cur.execute(
            """
            SELECT s.mano_raw AS ocr_mano_raw, hr.hero_cards AS xml_hero_cards
            FROM spots s
            JOIN hands hr ON hr.id = s.hand_id
            """
        ).fetchall()
        tot = ok = diff = unk = 0
        by: dict[str, dict[str, int]] = {}
        for r in linked:
            tot += 1
            okr = rank_key_obs(r["ocr_mano_raw"])
            xr = rank_key_real(r["xml_hero_cards"])
            if not okr or not xr:
                unk += 1
                res = "unk"
            elif okr == xr:
                ok += 1
                res = "ok"
            else:
                diff += 1
                res = "diff"

            mm = r["match_method"] or ""
            d = by.setdefault(mm, {"tot": 0, "ok": 0, "diff": 0, "unk": 0})
            d["tot"] += 1
            d[res] += 1

        print(f"- total links: {tot}")
        if tot:
            print(f"- ok: {ok} ({ok/tot:.1%}) | diff: {diff} ({diff/tot:.1%}) | unk: {unk} ({unk/tot:.1%})")
        print("- by match_method:")
        for mm, d in sorted(by.items(), key=lambda kv: (-kv[1]["tot"], kv[0])):
            name = mm or "(empty)"
            print(f"  - {name}: {d['tot']} | ok={d['ok']} diff={d['diff']} unk={d['unk']}")
    except Exception as e:
        print("ERR", e)

    con.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

