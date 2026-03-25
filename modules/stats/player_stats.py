# C:\Users\Usuario\Desktop\proyectos\poker_boss\modules\stats\player_stats.py
# Compute and cache per-player poker statistics from actions_real.
#
# Stats are split by table_size (number of players in the hand):
#   - 3 = 3-handed
#   - 2 = heads-up
# Each player has separate stat rows for each table_size they've played.
#
# Recalculate after importing new hands.

from __future__ import annotations

import logging
import sqlite3
import time
from collections import defaultdict
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

# ── Schema ───────────────────────────────────────────────────────────────

PLAYER_STATS_SCHEMA = """
CREATE TABLE IF NOT EXISTS player_stats (
    player TEXT NOT NULL,
    table_size INTEGER NOT NULL DEFAULT 3,
    total_hands INTEGER NOT NULL DEFAULT 0,
    vpip_hands INTEGER NOT NULL DEFAULT 0,
    pfr_hands INTEGER NOT NULL DEFAULT 0,
    threeb_hands INTEGER NOT NULL DEFAULT 0,
    threeb_opps INTEGER NOT NULL DEFAULT 0,
    fold_to_3b INTEGER NOT NULL DEFAULT 0,
    fold_to_3b_opps INTEGER NOT NULL DEFAULT 0,
    fourb_hands INTEGER NOT NULL DEFAULT 0,
    fourb_opps INTEGER NOT NULL DEFAULT 0,
    limp_hands INTEGER NOT NULL DEFAULT 0,
    af_bets_raises INTEGER NOT NULL DEFAULT 0,
    af_calls INTEGER NOT NULL DEFAULT 0,
    wtsd_hands INTEGER NOT NULL DEFAULT 0,
    wtsd_opps INTEGER NOT NULL DEFAULT 0,
    won_hands INTEGER NOT NULL DEFAULT 0,
    total_won_chips REAL NOT NULL DEFAULT 0,
    total_bet_chips REAL NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (player, table_size)
);
"""

STAT_COLUMNS = [
    "total_hands", "vpip_hands", "pfr_hands",
    "threeb_hands", "threeb_opps",
    "fold_to_3b", "fold_to_3b_opps",
    "fourb_hands", "fourb_opps",
    "limp_hands",
    "af_bets_raises", "af_calls",
    "wtsd_hands", "wtsd_opps",
    "won_hands", "total_won_chips", "total_bet_chips",
]


def ensure_player_stats_table(conn: sqlite3.Connection) -> None:
    # Drop old single-PK table if it exists, recreate with composite PK
    cur = conn.cursor()
    cur.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='player_stats'")
    row = cur.fetchone()
    if row and "table_size" not in (row[0] or ""):
        cur.execute("DROP TABLE player_stats")
        conn.commit()
    conn.executescript(PLAYER_STATS_SCHEMA)
    conn.commit()


# ── Data structures ──────────────────────────────────────────────────────

@dataclass
class PlayerAccum:
    total_hands: int = 0
    vpip_hands: int = 0
    pfr_hands: int = 0
    threeb_hands: int = 0
    threeb_opps: int = 0
    fold_to_3b: int = 0
    fold_to_3b_opps: int = 0
    fourb_hands: int = 0
    fourb_opps: int = 0
    limp_hands: int = 0
    af_bets_raises: int = 0
    af_calls: int = 0
    wtsd_hands: int = 0
    wtsd_opps: int = 0
    won_hands: int = 0
    total_won_chips: float = 0.0
    total_bet_chips: float = 0.0


# Key for accumulators: (player, table_size)
AccumKey = Tuple[str, int]


# ── Core calculation ─────────────────────────────────────────────────────

def _load_actions_by_hand(conn: sqlite3.Connection) -> Dict[int, List[Tuple]]:
    """Load all actions grouped by hand_id."""
    cur = conn.cursor()
    cur.execute("""
        SELECT hand_id, round_no, action_no, player, type_name, sum_chips
        FROM actions_real
        ORDER BY hand_id, round_no, action_no
    """)

    hands: Dict[int, List[Tuple]] = defaultdict(list)
    for row in cur:
        hand_id = row[0]
        hands[hand_id].append(row[1:])

    return hands


def _process_hand(actions: List[Tuple], accums: Dict[AccumKey, PlayerAccum]) -> None:
    """Process one hand's actions and update player accumulators.

    Each action tuple: (round_no, action_no, player, type_name, sum_chips)
    Stats are keyed by (player, table_size) where table_size = number of
    distinct players in the hand.
    """
    players_in_hand = {a[2] for a in actions}
    table_size = len(players_in_hand)

    # Skip hands with only 1 player (walkover, no useful stats)
    if table_size < 2:
        return

    # Ensure all players have accumulators for this table_size
    for player in players_in_hand:
        key = (player, table_size)
        if key not in accums:
            accums[key] = PlayerAccum()

    # ── Preflop analysis ──

    raise_count = 0
    raiser_sequence: List[str] = []
    vpip_players: set = set()
    pfr_players: set = set()
    limp_players: set = set()
    folded_preflop: set = set()

    for round_no, action_no, player, type_name, sum_chips in actions:
        if round_no > 1:
            break
        if type_name in ("POST_SB", "POST_BB", "ANTE"):
            continue

        if type_name in ("RAISE", "ALL_IN"):
            raise_count += 1
            raiser_sequence.append(player)
            vpip_players.add(player)
            pfr_players.add(player)
        elif type_name == "CALL":
            vpip_players.add(player)
            if raise_count == 0:
                limp_players.add(player)
        elif type_name == "FOLD":
            folded_preflop.add(player)

    # Update basic preflop stats
    for player in players_in_hand:
        acc = accums[(player, table_size)]
        acc.total_hands += 1
        if player in vpip_players:
            acc.vpip_hands += 1
        if player in pfr_players:
            acc.pfr_hands += 1
        if player in limp_players:
            acc.limp_hands += 1

    # ── 3-bet / fold-to-3-bet / 4-bet ──

    if raiser_sequence:
        open_raiser = raiser_sequence[0]

        saw_open = False
        for round_no, action_no, player, type_name, sum_chips in actions:
            if round_no > 1:
                break
            if type_name in ("POST_SB", "POST_BB", "ANTE"):
                continue

            if not saw_open:
                if player == open_raiser and type_name in ("RAISE", "ALL_IN"):
                    saw_open = True
                continue

            if player == open_raiser:
                continue

            if type_name in ("FOLD", "CALL", "RAISE", "ALL_IN", "CHECK"):
                accums[(player, table_size)].threeb_opps += 1

            if type_name in ("RAISE", "ALL_IN"):
                break

        if len(raiser_sequence) >= 2:
            accums[(raiser_sequence[1], table_size)].threeb_hands += 1

            accums[(open_raiser, table_size)].fold_to_3b_opps += 1
            if open_raiser in folded_preflop:
                accums[(open_raiser, table_size)].fold_to_3b += 1

            accums[(open_raiser, table_size)].fourb_opps += 1

        if len(raiser_sequence) >= 3:
            accums[(raiser_sequence[2], table_size)].fourb_hands += 1

    # ── Postflop stats ──

    saw_flop: set = set()
    folded_postflop: set = set()
    max_round = 0

    for round_no, action_no, player, type_name, sum_chips in actions:
        if round_no < 2:
            continue

        saw_flop.add(player)
        if round_no > max_round:
            max_round = round_no

        acc = accums[(player, table_size)]
        if type_name in ("BET", "RAISE", "ALL_IN"):
            acc.af_bets_raises += 1
        elif type_name == "CALL":
            acc.af_calls += 1
        elif type_name == "FOLD":
            folded_postflop.add(player)

    has_river = max_round >= 4
    for player in saw_flop:
        accums[(player, table_size)].wtsd_opps += 1
        if has_river and player not in folded_postflop:
            accums[(player, table_size)].wtsd_hands += 1

    # ── Chip tracking ──
    for round_no, action_no, player, type_name, sum_chips in actions:
        if type_name not in ("POST_SB", "POST_BB", "ANTE", "FOLD", "CHECK"):
            accums[(player, table_size)].total_bet_chips += sum_chips


def compute_player_stats(conn: sqlite3.Connection) -> Dict[AccumKey, PlayerAccum]:
    """Compute stats for all players from actions_real, split by table_size."""
    t0 = time.perf_counter()

    hands = _load_actions_by_hand(conn)
    logger.info("Loaded %d hands in %.1fs", len(hands), time.perf_counter() - t0)

    accums: Dict[AccumKey, PlayerAccum] = {}
    for hand_id, actions in hands.items():
        _process_hand(actions, accums)

    elapsed = time.perf_counter() - t0
    logger.info("Computed stats for %d player/size combos in %.1fs", len(accums), elapsed)
    return accums


def save_player_stats(conn: sqlite3.Connection, accums: Dict[AccumKey, PlayerAccum]) -> int:
    """Save computed stats to player_stats table. Returns rows written."""
    ensure_player_stats_table(conn)
    cur = conn.cursor()
    cur.execute("DELETE FROM player_stats")

    cols = ", ".join(STAT_COLUMNS)
    placeholders = ", ".join("?" for _ in STAT_COLUMNS)
    update_set = ", ".join(f"{c}=excluded.{c}" for c in STAT_COLUMNS)

    rows = []
    for (player, table_size), acc in accums.items():
        vals = [getattr(acc, c) for c in STAT_COLUMNS]
        rows.append((player, table_size, *vals))

    cur.executemany(
        f"""
        INSERT INTO player_stats(player, table_size, {cols}, updated_at)
        VALUES (?, ?, {placeholders}, datetime('now'))
        ON CONFLICT(player, table_size) DO UPDATE SET
            {update_set}, updated_at=datetime('now')
        """,
        rows,
    )
    conn.commit()
    return len(rows)


def refresh_player_stats(db_path: str, verbose: bool = True) -> Dict[str, Any]:
    """Full recalculation of player stats."""
    t0 = time.perf_counter()
    conn = sqlite3.connect(db_path)
    try:
        accums = compute_player_stats(conn)
        n = save_player_stats(conn, accums)
        elapsed = time.perf_counter() - t0

        # Count unique players
        unique_players = len({k[0] for k in accums})

        if verbose:
            print(f"[STATS] {unique_players} players, {n} rows (by table_size) in {elapsed:.1f}s")

        return {"ok": True, "players": unique_players, "rows": n, "elapsed_s": round(elapsed, 2)}
    finally:
        conn.close()


def get_player_stats(
    db_path: str, player: str, table_size: Optional[int] = None,
) -> Optional[Dict[str, Any]]:
    """Fetch cached stats for one player. If table_size is None, returns combined."""
    conn = sqlite3.connect(db_path)
    try:
        ensure_player_stats_table(conn)
        cur = conn.cursor()
        if table_size is not None:
            cur.execute(
                "SELECT * FROM player_stats WHERE player = ? AND table_size = ?",
                (player, table_size),
            )
            row = cur.fetchone()
            if not row:
                return None
            cols = [d[0] for d in cur.description]
            return dict(zip(cols, row))
        else:
            # Combine all table_sizes
            cur.execute("SELECT * FROM player_stats WHERE player = ?", (player,))
            rows = cur.fetchall()
            if not rows:
                return None
            cols = [d[0] for d in cur.description]
            combined = {"player": player, "table_size": 0}
            for c in STAT_COLUMNS:
                idx = cols.index(c)
                combined[c] = sum(row[idx] for row in rows)
            return combined
    finally:
        conn.close()


def get_all_player_stats(
    db_path: str, min_hands: int = 10, table_size: Optional[int] = None,
) -> List[Dict[str, Any]]:
    """Fetch cached stats for all players with at least min_hands."""
    conn = sqlite3.connect(db_path)
    try:
        ensure_player_stats_table(conn)
        cur = conn.cursor()
        if table_size is not None:
            cur.execute(
                "SELECT * FROM player_stats WHERE total_hands >= ? AND table_size = ? "
                "ORDER BY total_hands DESC",
                (min_hands, table_size),
            )
        else:
            cur.execute(
                "SELECT * FROM player_stats WHERE total_hands >= ? ORDER BY total_hands DESC",
                (min_hands,),
            )
        cols = [d[0] for d in cur.description]
        return [dict(zip(cols, row)) for row in cur.fetchall()]
    finally:
        conn.close()


def format_player_stats(stats: Dict[str, Any]) -> str:
    """Format stats dict into readable string with percentages."""
    if not stats:
        return "No stats available"

    total = stats.get("total_hands", 0)
    if total == 0:
        return f"{stats.get('player', '?')}: 0 hands"

    ts = stats.get("table_size", 0)
    ts_label = {2: "HU", 3: "3H"}.get(ts, "ALL") if ts else "ALL"

    def pct(num: int, den: int) -> str:
        if den == 0:
            return "-"
        return f"{num / den * 100:.1f}%"

    af_calls = stats.get("af_calls", 0)
    af_br = stats.get("af_bets_raises", 0)
    af = f"{af_br / af_calls:.1f}" if af_calls > 0 else "-"

    lines = [
        f"{stats['player']} [{ts_label}] ({total} hands)",
        f"  VPIP:  {pct(stats['vpip_hands'], total)}",
        f"  PFR:   {pct(stats['pfr_hands'], total)}",
        f"  3-Bet: {pct(stats['threeb_hands'], stats['threeb_opps'])}",
        f"  Fold to 3-Bet: {pct(stats['fold_to_3b'], stats['fold_to_3b_opps'])}",
        f"  4-Bet: {pct(stats['fourb_hands'], stats['fourb_opps'])}",
        f"  Limp:  {pct(stats['limp_hands'], total)}",
        f"  AF:    {af}",
        f"  WTSD:  {pct(stats['wtsd_hands'], stats['wtsd_opps'])}",
    ]
    return "\n".join(lines)


if __name__ == "__main__":
    import sys

    db_path = sys.argv[1] if len(sys.argv) > 1 else "data/poker_boss.db"
    result = refresh_player_stats(db_path)
    print(result)
