import argparse
import sqlite3
import time
from datetime import datetime

DEFAULT_DB = r"C:\Users\Usuario\Desktop\proyectos\poker_boss\data\poker_boss.db"


def rank_key_obs(mano_raw):
    if not mano_raw or len(mano_raw) < 4:
        return None

    r1 = str(mano_raw)[0].upper()
    r2 = str(mano_raw)[2].upper()

    if r1 == "1":
        r1 = "T"
    if r2 == "1":
        r2 = "T"

    return "".join(sorted([r1, r2]))


def rank_key_real(hero_cards):
    if not hero_cards:
        return None

    parts = str(hero_cards).split()
    if len(parts) != 2:
        return None

    def extract_rank(card):
        card = str(card).strip().upper()
        if len(card) < 2:
            return None
        rank = card[1:]
        if rank == "10":
            return "T"
        return rank

    r1 = extract_rank(parts[0])
    r2 = extract_rank(parts[1])

    if not r1 or not r2:
        return None

    return "".join(sorted([r1, r2]))


def startdate_to_ms(s):
    dt = datetime.strptime(s, "%Y-%m-%d %H:%M:%S")
    return int(dt.timestamp() * 1000)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", default=DEFAULT_DB)
    args = ap.parse_args()

    con = sqlite3.connect(args.db)
    con.row_factory = sqlite3.Row
    cur = con.cursor()

    obs_rows = cur.execute(
        "SELECT obs_id, mano_raw, detected_at_ms FROM hands_obs WHERE preflop_ok=1 ORDER BY obs_id ASC"
    ).fetchall()

    real_rows = cur.execute(
        "SELECT gamecode, hero_cards, startdate FROM hands_real ORDER BY startdate ASC"
    ).fetchall()

    real_prepared = []
    for real in real_rows:
        try:
            t_ms = startdate_to_ms(real["startdate"])
        except Exception:
            continue

        real_prepared.append(
            {
                "gamecode": real["gamecode"],
                "hero_cards": real["hero_cards"],
                "startdate": real["startdate"],
                "t_ms": t_ms,
                "rank_key": rank_key_real(real["hero_cards"]),
            }
        )

    used_gamecodes = set()
    linked_obs_ids = set()
    links = []

    # FASE 1: rank + time
    for obs in obs_rows:
        obs_id = obs["obs_id"]
        rkey = rank_key_obs(obs["mano_raw"])
        if not rkey:
            continue

        t_obs = obs["detected_at_ms"]
        best = None
        best_dt = None

        for real in real_prepared:
            if real["gamecode"] in used_gamecodes:
                continue
            if real["rank_key"] != rkey:
                continue

            dt = abs(real["t_ms"] - t_obs)
            if dt > 90000:
                continue

            if best is None or dt < best_dt:
                best = real
                best_dt = dt

        if best is not None:
            used_gamecodes.add(best["gamecode"])
            linked_obs_ids.add(obs_id)
            links.append(
                (
                    obs_id,
                    best["gamecode"],
                    1.00,
                    "rank+time",
                    int(time.time() * 1000),
                )
            )

    # FASE 2: fallback por tiempo solo para no enlazados
    for obs in obs_rows:
        obs_id = obs["obs_id"]
        if obs_id in linked_obs_ids:
            continue

        t_obs = obs["detected_at_ms"]
        best = None
        best_dt = None

        for real in real_prepared:
            if real["gamecode"] in used_gamecodes:
                continue

            dt = abs(real["t_ms"] - t_obs)
            if dt > 15000:
                continue

            if best is None or dt < best_dt:
                best = real
                best_dt = dt

        if best is not None:
            used_gamecodes.add(best["gamecode"])
            linked_obs_ids.add(obs_id)
            links.append(
                (
                    obs_id,
                    best["gamecode"],
                    0.55,
                    "time_fallback",
                    int(time.time() * 1000),
                )
            )

    cur.executemany(
        """
        INSERT OR REPLACE INTO hand_links
        (obs_id, gamecode, match_score, match_method, created_at_ms)
        VALUES (?, ?, ?, ?, ?)
        """,
        links,
    )

    con.commit()
    con.close()

    print("links created:", len(links))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
