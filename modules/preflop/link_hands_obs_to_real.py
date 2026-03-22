import argparse
import json
import os
import sqlite3
import time
from datetime import datetime
from typing import Any, Dict, Iterable, Optional

from modules.db.migrate import init_db

DEFAULT_DB = r"C:\Users\Usuario\Desktop\proyectos\poker_boss\data\poker_boss.db"


def _normalize_rank_token(value):
    token = str(value or "").strip().upper()
    if not token:
        return None
    if token in {"10", "1"}:
        return "T"
    if token in {"A", "K", "Q", "J", "T", "9", "8", "7", "6", "5", "4", "3", "2"}:
        return token
    return None


def canonical_rank_key(rank1, rank2):
    r1 = _normalize_rank_token(rank1)
    r2 = _normalize_rank_token(rank2)
    if not r1 or not r2:
        return None
    return "".join(sorted([r1, r2]))


def _extract_rank_from_card_token(card_token):
    token = str(card_token or "").strip().upper()
    if not token:
        return None

    for rank in ("10", "A", "K", "Q", "J", "T", "9", "8", "7", "6", "5", "4", "3", "2", "1"):
        if token.startswith(rank):
            return _normalize_rank_token(rank)
        if token.endswith(rank):
            return _normalize_rank_token(rank)

    return None


def _extract_obs_card_ranks(mano_raw):
    compact = str(mano_raw or "").replace(" ", "").upper()
    if not compact:
        return (None, None)

    ranks = []
    idx = 0
    while idx < len(compact) and len(ranks) < 2:
        rank = None
        if compact[idx : idx + 2] == "10":
            rank = "T"
            idx += 2
        else:
            rank = _normalize_rank_token(compact[idx])
            idx += 1

        if not rank:
            continue

        if idx < len(compact):
            idx += 1
        ranks.append(rank)

    if len(ranks) != 2:
        return (None, None)

    return ranks[0], ranks[1]


def rank_key_obs(mano_raw):
    r1, r2 = _extract_obs_card_ranks(mano_raw)
    return canonical_rank_key(r1, r2)


def rank_key_real(hero_cards):
    if not hero_cards:
        return None

    parts = str(hero_cards).split()
    if len(parts) == 2:
        r1 = _extract_rank_from_card_token(parts[0])
        r2 = _extract_rank_from_card_token(parts[1])
        return canonical_rank_key(r1, r2)

    r1, r2 = _extract_obs_card_ranks(hero_cards)
    return canonical_rank_key(r1, r2)


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


def _compute_bet_distance(cur, actions_by_hand_id, obs_bet_profile, real):
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
        return None

    action_totals = actions_by_hand_id.get(hand_id) or {}
    if not action_totals:
        return None

    real_bet_profile = []
    for player_name in player_order:
        total_bb = action_totals.get(player_name)
        if total_bb is None:
            return None
        real_bet_profile.append(total_bb)

    if len(real_bet_profile) != 3:
        return None

    return bet_distance_total(obs_bet_profile, real_bet_profile)


def _obs_query(obs_ids: Optional[Iterable[int]]) -> tuple[str, tuple[Any, ...]]:
    base_sql = (
        "SELECT obs_id, mano_raw, detected_at_ms, ocr_json, captured_gamecode "
        "FROM spots WHERE preflop_ok=1"
    )
    params: tuple[Any, ...] = ()
    if obs_ids is not None:
        ids = [int(obs_id) for obs_id in obs_ids]
        if not ids:
            return base_sql + " AND 1=0 ORDER BY obs_id ASC", ()
        placeholders = ",".join("?" for _ in ids)
        base_sql += f" AND obs_id IN ({placeholders})"
        params = tuple(ids)
    return base_sql + " ORDER BY obs_id ASC", params


def link_hands_obs_to_real(
    *,
    db_path: str,
    stack_bb_tolerance: float = 4.0,
    bet_bb_tolerance: float = 2.0,
    report: bool = False,
    obs_ids: Optional[Iterable[int]] = None,
) -> Dict[str, Any]:
    prev_db_path = os.environ.get("POKER_BOSS_DB_PATH")
    prev_legacy_db_path = os.environ.get("MUSICA_DB_PATH")
    os.environ["POKER_BOSS_DB_PATH"] = db_path
    os.environ["MUSICA_DB_PATH"] = db_path

    con = None
    links = []
    ambiguous_rank_only = 0
    rank_ambiguous_stacks_resolved = 0
    rank_ambiguous_bets_resolved = 0
    skipped_no_candidate = 0
    skipped_no_rank = 0
    report_rows = []

    try:
        init_db()

        con = sqlite3.connect(db_path)
        con.row_factory = sqlite3.Row
        cur = con.cursor()

        obs_sql, obs_params = _obs_query(obs_ids)
        obs_rows = cur.execute(obs_sql, obs_params).fetchall()

        real_rows = cur.execute(
            "SELECT id, gamecode, hero_cards, startdate, hero, bb, players_json FROM hands ORDER BY startdate ASC"
        ).fetchall()

        real_prepared = []
        real_by_gamecode = {}
        actions_by_hand_id = {}
        for real in real_rows:
            try:
                t_ms = startdate_to_ms(real["startdate"])
            except Exception:
                continue

            prepared = {
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
            real_prepared.append(prepared)
            real_by_gamecode.setdefault(real["gamecode"], []).append(prepared)

        used_gamecodes = set()
        linked_obs_ids = set()

        for obs in obs_rows:
            obs_id = obs["obs_id"]
            captured_gamecode = str(obs["captured_gamecode"] or "").strip()
            if not captured_gamecode or obs_id in linked_obs_ids:
                continue

            candidates_gamecode = real_by_gamecode.get(captured_gamecode, [])
            if len(candidates_gamecode) != 1:
                continue

            best = candidates_gamecode[0]
            if best["gamecode"] in used_gamecodes:
                continue

            used_gamecodes.add(best["gamecode"])
            linked_obs_ids.add(obs_id)
            links.append(
                (
                    obs_id,
                    best["gamecode"],
                    1.00,
                    "gamecode_ocr",
                    int(time.time() * 1000),
                )
            )

        for obs in obs_rows:
            obs_id = obs["obs_id"]
            if obs_id in linked_obs_ids:
                continue

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
                if report:
                    report_rows.append(
                        {
                            "obs_id": obs_id,
                            "rank_key": rkey,
                            "status": "no_candidate",
                            "min_stack_dist": None,
                            "min_bet_dist": None,
                        }
                    )
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

            candidates_stacks = []
            min_stack_distance = None
            for real in candidates_rank:
                real_stack_profile = extract_real_stack_profile(
                    real.get("hero"), real.get("bb"), real.get("players_json")
                )
                distance_total = stack_distance_total(obs_stack_profile, real_stack_profile)
                if distance_total is None:
                    continue
                if min_stack_distance is None or distance_total < min_stack_distance:
                    min_stack_distance = distance_total
                if distance_total <= stack_bb_tolerance:
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

            obs_bet_profile = extract_obs_bet_profile(obs["ocr_json"])
            min_bet_distance = None
            if report:
                for real in candidates_rank:
                    distance_bets = _compute_bet_distance(cur, actions_by_hand_id, obs_bet_profile, real)
                    if distance_bets is None:
                        continue
                    if min_bet_distance is None or distance_bets < min_bet_distance:
                        min_bet_distance = distance_bets

            candidates_for_bets = candidates_stacks if len(candidates_stacks) > 1 else []
            candidates_bets = []

            for real in candidates_for_bets:
                distance_bets = _compute_bet_distance(cur, actions_by_hand_id, obs_bet_profile, real)
                if distance_bets is None:
                    continue
                if distance_bets <= bet_bb_tolerance:
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
                if report:
                    report_rows.append(
                        {
                            "obs_id": obs_id,
                            "rank_key": rkey,
                            "status": "ambiguous_rank_only",
                            "min_stack_dist": min_stack_distance,
                            "min_bet_dist": min_bet_distance,
                        }
                    )

        if not report and links:
            # links tuples: (obs_id, gamecode, score, method, ts)
            # Build gamecode→hand_id map for UPDATE spots SET hand_id
            gamecodes = list({gc for _, gc, *_ in links})
            placeholders = ",".join("?" for _ in gamecodes)
            hand_map = {}
            for row in cur.execute(
                f"SELECT id, gamecode FROM hands WHERE gamecode IN ({placeholders})",
                gamecodes,
            ).fetchall():
                hand_map[row["gamecode"]] = row["id"]

            updates = [
                (hand_map[gc], obs_id)
                for obs_id, gc, *_ in links
                if gc in hand_map
            ]
            if updates:
                cur.executemany(
                    "UPDATE spots SET hand_id = ? WHERE obs_id = ?",
                    updates,
                )
            con.commit()

        return {
            "links_created": len(links),
            "skipped": {
                "ambiguous_rank_only": ambiguous_rank_only,
                "no_candidate": skipped_no_candidate,
                "no_rank": skipped_no_rank,
                "rank_ambiguous_bets_resolved": rank_ambiguous_bets_resolved,
                "rank_ambiguous_stacks_resolved": rank_ambiguous_stacks_resolved,
            },
            "report_rows": report_rows,
        }
    finally:
        if con is not None:
            con.close()

        if prev_db_path is None:
            os.environ.pop("POKER_BOSS_DB_PATH", None)
        else:
            os.environ["POKER_BOSS_DB_PATH"] = prev_db_path

        if prev_legacy_db_path is None:
            os.environ.pop("MUSICA_DB_PATH", None)
        else:
            os.environ["MUSICA_DB_PATH"] = prev_legacy_db_path


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", default=DEFAULT_DB)
    ap.add_argument("--stack_bb_tolerance", type=float, default=4.0)
    ap.add_argument("--bet_bb_tolerance", type=float, default=2.0)
    ap.add_argument("--report", action="store_true", help="Only print diagnostic report for unlinked obs, no write links")
    args = ap.parse_args()

    result = link_hands_obs_to_real(
        db_path=args.db,
        stack_bb_tolerance=args.stack_bb_tolerance,
        bet_bb_tolerance=args.bet_bb_tolerance,
        report=args.report,
    )

    print("links created:", result["links_created"])
    print("skipped:", result["skipped"])
    if args.report:
        for row in result["report_rows"]:
            min_stack_dist = "-" if row["min_stack_dist"] is None else f"{row['min_stack_dist']:.3f}"
            min_bet_dist = "-" if row["min_bet_dist"] is None else f"{row['min_bet_dist']:.3f}"
            print(
                f"obs_id={row['obs_id']} rank_key={row['rank_key']} status={row['status']} "
                f"min_stack_dist={min_stack_dist} min_bet_dist={min_bet_dist}"
            )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
