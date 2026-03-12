import argparse
import json
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


def _as_float(value):
    try:
        if value is None or value == "":
            return None
        return float(value)
    except Exception:
        return None


def extract_obs_stack_profile(ocr_json):
    try:
        payload = json.loads(ocr_json or "{}")
    except Exception:
        return None

    if not isinstance(payload, dict):
        return None

    ocr = payload.get("ocr")
    if not isinstance(ocr, dict):
        return None

    stacks = ocr.get("stacks")
    if not isinstance(stacks, dict):
        return None

    hero_stack = _as_float(stacks.get("p1"))
    vill1_stack = _as_float(stacks.get("p2"))
    vill2_stack = _as_float(stacks.get("p3"))
    if hero_stack is None or vill1_stack is None or vill2_stack is None:
        return None

    return [hero_stack, vill1_stack, vill2_stack]


def extract_obs_bet_profile(ocr_json):
    try:
        payload = json.loads(ocr_json or "{}")
    except Exception:
        return None

    if not isinstance(payload, dict):
        return None

    ocr = payload.get("ocr")
    if not isinstance(ocr, dict):
        return None

    bets = ocr.get("bets")
    if not isinstance(bets, dict):
        return None

    hero_bet = _as_float(bets.get("p1"))
    vill1_bet = _as_float(bets.get("p2"))
    vill2_bet = _as_float(bets.get("p3"))
    if hero_bet is None or vill1_bet is None or vill2_bet is None:
        return None

    return [hero_bet, vill1_bet, vill2_bet]


def extract_real_stack_profile(hero_name, bb_value, players_json):
    bb = _as_float(bb_value)
    if bb is None or bb <= 0:
        return None

    try:
        payload = json.loads(players_json or "{}")
    except Exception:
        return None

    if not isinstance(payload, dict):
        return None

    players = payload.get("players")
    if not isinstance(players, list) or len(players) < 3:
        return None

    hero_stack = None
    villain_stacks = []

    for player in players:
        if not isinstance(player, dict):
            return None
        chips = _as_float(player.get("chips"))
        if chips is None:
            return None
        stack_bb = chips / bb
        if str(player.get("name") or "") == str(hero_name or "") and hero_stack is None:
            hero_stack = stack_bb
        else:
            villain_stacks.append(stack_bb)

    if hero_stack is None or len(villain_stacks) < 2:
        return None

    return [hero_stack, villain_stacks[0], villain_stacks[1]]


def extract_real_player_order(hero_name, players_json):
    try:
        payload = json.loads(players_json or "{}")
    except Exception:
        return None

    if not isinstance(payload, dict):
        return None

    players = payload.get("players")
    if not isinstance(players, list) or len(players) < 3:
        return None

    hero_player = None
    villain_players = []

    for player in players:
        if not isinstance(player, dict):
            return None
        player_name = str(player.get("name") or "")
        if player_name == str(hero_name or "") and hero_player is None:
            hero_player = player_name
        else:
            villain_players.append(player_name)

    if hero_player is None or len(villain_players) < 2:
        return None

    return [hero_player, villain_players[0], villain_players[1]]


def stack_distance_total(obs_profile, real_profile):
    if not obs_profile or not real_profile:
        return None

    if len(obs_profile) != 3 or len(real_profile) != 3:
        return None

    return sum(abs(obs_profile[idx] - real_profile[idx]) for idx in range(3))


def bet_distance_total(obs_profile, real_profile):
    if not obs_profile or not real_profile:
        return None

    if len(obs_profile) != 3 or len(real_profile) != 3:
        return None

    return sum(abs(obs_profile[idx] - real_profile[idx]) for idx in range(3))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", default=DEFAULT_DB)
    args = ap.parse_args()

    con = sqlite3.connect(args.db)
    con.row_factory = sqlite3.Row
    cur = con.cursor()

    obs_rows = cur.execute(
        "SELECT obs_id, mano_raw, detected_at_ms, ocr_json FROM hands_obs WHERE preflop_ok=1 ORDER BY obs_id ASC"
    ).fetchall()

    real_rows = cur.execute(
        "SELECT id, gamecode, hero_cards, startdate, hero, bb, players_json FROM hands_real ORDER BY startdate ASC"
    ).fetchall()

    real_prepared = []
    actions_by_hand_id = {}
    for real in real_rows:
        try:
            t_ms = startdate_to_ms(real["startdate"])
        except Exception:
            continue

        real_prepared.append(
            {
                "hand_id": real["id"],
                "gamecode": real["gamecode"],
                "hero_cards": real["hero_cards"],
                "startdate": real["startdate"],
                "t_ms": t_ms,
                "rank_key": rank_key_real(real["hero_cards"]),
                "players_json": real["players_json"],
                "bb": real["bb"],
                "hero": real["hero"],
            }
        )

    used_gamecodes = set()
    linked_obs_ids = set()
    links = []
    ambiguous_rank_only = 0
    rank_ambiguous_stacks_resolved = 0
    rank_ambiguous_bets_resolved = 0
    skipped_no_candidate = 0
    skipped_no_rank = 0
    debug_first_ambiguous_printed = False

    # FASE 1: rank only + uniqueness (sin usar tiempo para decidir)
    for obs in obs_rows:
        obs_id = obs["obs_id"]
        rkey = rank_key_obs(obs["mano_raw"])
        if not rkey:
            skipped_no_rank += 1
            continue

        candidates_rank = []

        for real in real_prepared:
            if real["gamecode"] in used_gamecodes:
                continue
            if real["rank_key"] != rkey:
                continue
            candidates_rank.append(real)

        if not candidates_rank:
            skipped_no_candidate += 1
            continue

        if len(candidates_rank) == 1:
            best = candidates_rank[0]
            used_gamecodes.add(best["gamecode"])
            linked_obs_ids.add(obs_id)
            links.append(
                (
                    obs_id,
                    best["gamecode"],
                    1.00,
                    "rank_only",
                    int(time.time() * 1000),
                )
            )

            continue

        obs_stack_profile = extract_obs_stack_profile(obs["ocr_json"])
        if not debug_first_ambiguous_printed:
            print(f"DEBUG first ambiguous obs_id={obs_id} ocr_stacks_p1_p2_p3={obs_stack_profile}")
            first_real = candidates_rank[0]
            first_real_profile = extract_real_stack_profile(
                first_real.get("hero"), first_real.get("bb"), first_real.get("players_json")
            )
            print(
                "DEBUG first real candidate "
                f"gamecode={first_real['gamecode']} bb={first_real.get('bb')} "
                f"parsed_stacks_bb={first_real_profile}"
            )
            debug_first_ambiguous_printed = True

        candidates_stacks = []
        for real in candidates_rank:
            real_stack_profile = extract_real_stack_profile(
                real.get("hero"), real.get("bb"), real.get("players_json")
            )
            distance_total = stack_distance_total(obs_stack_profile, real_stack_profile)
            if distance_total is None:
                continue
            if distance_total <= 3.0:
                candidates_stacks.append(real)

        if len(candidates_stacks) == 1:
            best = candidates_stacks[0]
            used_gamecodes.add(best["gamecode"])
            linked_obs_ids.add(obs_id)
            rank_ambiguous_stacks_resolved += 1
            links.append(
                (
                    obs_id,
                    best["gamecode"],
                    1.00,
                    "rank+stacks",
                    int(time.time() * 1000),
                )
            )
            continue

        candidates_for_bets = candidates_stacks if len(candidates_stacks) > 1 else []
        obs_bet_profile = extract_obs_bet_profile(obs["ocr_json"])
        candidates_bets = []

        for real in candidates_for_bets:
            hand_id = real.get("hand_id")
            if hand_id not in actions_by_hand_id:
                action_rows = cur.execute(
                    """
                    SELECT player, SUM(sum_bb) AS total_bb
                    FROM actions_real
                    WHERE hand_id = ? AND round_no = 1
                    GROUP BY player
                    """,
                    (hand_id,),
                ).fetchall()
                actions_by_hand_id[hand_id] = {
                    str(row["player"]): _as_float(row["total_bb"]) for row in action_rows
                }

            player_order = extract_real_player_order(real.get("hero"), real.get("players_json"))
            if not player_order or obs_bet_profile is None:
                continue

            action_totals = actions_by_hand_id.get(hand_id) or {}
            if not action_totals:
                continue

            real_bet_profile = []
            missing_bet = False
            for player_name in player_order:
                total_bb = action_totals.get(player_name)
                if total_bb is None:
                    missing_bet = True
                    break
                real_bet_profile.append(total_bb)

            if missing_bet or len(real_bet_profile) != 3:
                continue

            distance_bets = bet_distance_total(obs_bet_profile, real_bet_profile)
            if distance_bets is None:
                continue
            if distance_bets <= 1.5:
                candidates_bets.append(real)

        if len(candidates_bets) == 1:
            best = candidates_bets[0]
            used_gamecodes.add(best["gamecode"])
            linked_obs_ids.add(obs_id)
            rank_ambiguous_bets_resolved += 1
            links.append(
                (
                    obs_id,
                    best["gamecode"],
                    1.00,
                    "rank+stacks+bets",
                    int(time.time() * 1000),
                )
            )
        else:
            ambiguous_rank_only += 1

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
    print(
        "skipped:",
        {
            "ambiguous_rank_only": ambiguous_rank_only,
            "no_candidate": skipped_no_candidate,
            "no_rank": skipped_no_rank,
            "rank_ambiguous_bets_resolved": rank_ambiguous_bets_resolved,
            "rank_ambiguous_stacks_resolved": rank_ambiguous_stacks_resolved,
        },
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
