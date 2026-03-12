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
    skipped_ambiguous = 0
    skipped_no_candidate = 0
    cleared_prev_time_links = 0
    skipped_time_rank_mismatch = 0

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

    # FASE 2: fallback por tiempo SOLO si el match no es ambiguo.
    #
    # Problema observado: con varias manos cercanas en el tiempo (multi-mesa / reloj desalineado),
    # elegir "la más cercana" produce falsos positivos.
    #
    # Regla: solo linkear si:
    #  - hay exactamente 1 candidata dentro de la ventana, o
    #  - la mejor candidata está claramente separada de la segunda (margen suficiente).
    for obs in obs_rows:
        obs_id = obs["obs_id"]
        if obs_id in linked_obs_ids:
            continue

        # Si el obs_id ya tenía un link previo por tiempo (legacy), lo limpiamos para evitar
        # que un match ahora ambiguo deje un enlace incorrecto "pegado" en UI.
        #
        # Importante: solo tocamos métodos de tipo tiempo; no borramos los rank+time.
        try:
            cur.execute(
                """
                DELETE FROM hand_links
                WHERE obs_id = ?
                  AND (match_method = 'time_fallback' OR match_method LIKE 'time_%')
                """,
                (int(obs_id),),
            )
            if cur.rowcount and cur.rowcount > 0:
                cleared_prev_time_links += int(cur.rowcount)
        except Exception:
            # Si falla por cualquier motivo, seguimos sin abortar el matching.
            pass

        t_obs = obs["detected_at_ms"]
        obs_rkey = rank_key_obs(obs["mano_raw"])
        candidates = []

        for real in real_prepared:
            if real["gamecode"] in used_gamecodes:
                continue

            dt = abs(real["t_ms"] - t_obs)
            if dt > 15000:
                continue

            candidates.append((dt, real))

        if not candidates:
            skipped_no_candidate += 1
            continue

        candidates.sort(key=lambda x: x[0])
        best_dt, best_real = candidates[0]
        best_rkey = best_real.get("rank_key")

        # If we have rank keys on both sides, require them to match even in time fallback.
        # This prevents obvious false positives where time is close but cards differ.
        if obs_rkey and best_rkey and obs_rkey != best_rkey:
            skipped_time_rank_mismatch += 1
            continue

        # Case A: unique candidate -> accept
        if len(candidates) == 1:
            used_gamecodes.add(best_real["gamecode"])
            linked_obs_ids.add(obs_id)
            links.append(
                (
                    obs_id,
                    best_real["gamecode"],
                    0.55,
                    "time_unique",
                    int(time.time() * 1000),
                )
            )
            continue

        # Case B: clear winner -> accept if margin is big enough
        second_dt, _second_real = candidates[1]
        margin = second_dt - best_dt

        # Conservative thresholds to avoid false positives.
        # - best must be pretty close in time
        # - second must be sufficiently farther away
        if best_dt <= 3000 and margin >= 5000:
            used_gamecodes.add(best_real["gamecode"])
            linked_obs_ids.add(obs_id)
            links.append(
                (
                    obs_id,
                    best_real["gamecode"],
                    0.55,
                    "time_clear_winner",
                    int(time.time() * 1000),
                )
            )
        else:
            skipped_ambiguous += 1

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
    print("skipped:", {"no_candidate": skipped_no_candidate, "ambiguous": skipped_ambiguous})
    print("cleared_prev_time_links:", cleared_prev_time_links)
    print("skipped_time_rank_mismatch:", skipped_time_rank_mismatch)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
