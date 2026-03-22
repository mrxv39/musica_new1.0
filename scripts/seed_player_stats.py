"""
Seed player_stats table with realistic demo data.

Uses existing players from the players table and generates
plausible stats based on player tipo (fish/reg).

Usage:
    python scripts/seed_player_stats.py
"""

import random
import sqlite3
import sys
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "musica_new.db"


def create_table(cur: sqlite3.Cursor) -> None:
    cur.execute("""
        CREATE TABLE IF NOT EXISTS player_stats (
            player TEXT NOT NULL,
            table_size INTEGER NOT NULL DEFAULT 2,
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
    """)


# Ranges: (min, max) as fractions 0-1
PROFILES = {
    "fish": {
        "vpip": (0.45, 0.80),
        "pfr": (0.05, 0.18),
        "threeb": (0.02, 0.06),
        "fold_to_3b": (0.30, 0.55),
        "limp": (0.25, 0.55),
        "af": (0.3, 1.2),
        "wtsd": (0.30, 0.50),
    },
    "reg": {
        "vpip": (0.22, 0.38),
        "pfr": (0.18, 0.32),
        "threeb": (0.06, 0.14),
        "fold_to_3b": (0.45, 0.65),
        "limp": (0.02, 0.10),
        "af": (1.5, 3.5),
        "wtsd": (0.22, 0.35),
    },
    "shark": {
        "vpip": (0.18, 0.28),
        "pfr": (0.16, 0.26),
        "threeb": (0.08, 0.16),
        "fold_to_3b": (0.50, 0.70),
        "limp": (0.01, 0.05),
        "af": (2.5, 5.0),
        "wtsd": (0.20, 0.30),
    },
}


def rand_between(lo: float, hi: float) -> float:
    return random.uniform(lo, hi)


def gen_row(player: str, tipo: str, table_size: int) -> dict:
    profile = PROFILES.get(tipo, PROFILES["fish"])

    # More hands for regs/sharks, fewer for fish
    if tipo == "fish":
        total = random.randint(15, 200)
    elif tipo == "reg":
        total = random.randint(50, 800)
    else:
        total = random.randint(100, 1500)

    vpip_rate = rand_between(*profile["vpip"])
    pfr_rate = rand_between(*profile["pfr"])
    threeb_rate = rand_between(*profile["threeb"])
    f3b_rate = rand_between(*profile["fold_to_3b"])
    limp_rate = rand_between(*profile["limp"])
    af_val = rand_between(*profile["af"])
    wtsd_rate = rand_between(*profile["wtsd"])

    vpip_hands = int(total * vpip_rate)
    pfr_hands = int(total * pfr_rate)
    threeb_opps = int(total * 0.4)
    threeb_hands = int(threeb_opps * threeb_rate)
    f3b_opps = int(total * 0.15)
    fold_to_3b = int(f3b_opps * f3b_rate)
    limp_hands = int(total * limp_rate)

    # AF = bets_raises / calls
    af_calls = random.randint(max(10, total // 5), max(20, total // 2))
    af_bets_raises = int(af_calls * af_val)

    wtsd_opps = int(total * 0.35)
    wtsd_hands = int(wtsd_opps * wtsd_rate)

    won_hands = int(total * random.uniform(0.35, 0.55))

    return {
        "player": player,
        "table_size": table_size,
        "total_hands": total,
        "vpip_hands": vpip_hands,
        "pfr_hands": pfr_hands,
        "threeb_hands": threeb_hands,
        "threeb_opps": threeb_opps,
        "fold_to_3b": fold_to_3b,
        "fold_to_3b_opps": f3b_opps,
        "fourb_hands": random.randint(0, max(1, threeb_hands // 3)),
        "fourb_opps": random.randint(0, max(1, threeb_opps // 3)),
        "limp_hands": limp_hands,
        "af_bets_raises": af_bets_raises,
        "af_calls": af_calls,
        "wtsd_hands": wtsd_hands,
        "wtsd_opps": wtsd_opps,
        "won_hands": won_hands,
        "total_won_chips": round(random.uniform(-500, 500), 2),
        "total_bet_chips": round(random.uniform(100, 5000), 2),
    }


def main() -> None:
    if not DB_PATH.exists():
        print(f"DB not found: {DB_PATH}")
        sys.exit(1)

    conn = sqlite3.connect(str(DB_PATH))
    cur = conn.cursor()

    create_table(cur)

    # Get existing players
    cur.execute("SELECT name, tipo FROM players")
    players = cur.fetchall()
    print(f"Found {len(players)} players in DB")

    # Assign some fish as sharks (bottom 5% by random)
    shark_count = max(5, len(players) // 20)
    shark_names = set()
    fish_players = [p for p in players if p[1] == "fish"]
    if fish_players:
        random.shuffle(fish_players)
        for p in fish_players[:shark_count]:
            shark_names.add(p[0])

    # Clear existing data
    cur.execute("DELETE FROM player_stats")

    inserted = 0
    for name, tipo in players:
        effective_tipo = tipo
        if name in shark_names:
            effective_tipo = "shark"

        # Each player gets stats for HU (2) and optionally 3H (3)
        for ts in [2]:
            row = gen_row(name, effective_tipo, ts)
            cur.execute("""
                INSERT INTO player_stats (
                    player, table_size, total_hands,
                    vpip_hands, pfr_hands, threeb_hands, threeb_opps,
                    fold_to_3b, fold_to_3b_opps, fourb_hands, fourb_opps,
                    limp_hands, af_bets_raises, af_calls,
                    wtsd_hands, wtsd_opps, won_hands,
                    total_won_chips, total_bet_chips
                ) VALUES (
                    :player, :table_size, :total_hands,
                    :vpip_hands, :pfr_hands, :threeb_hands, :threeb_opps,
                    :fold_to_3b, :fold_to_3b_opps, :fourb_hands, :fourb_opps,
                    :limp_hands, :af_bets_raises, :af_calls,
                    :wtsd_hands, :wtsd_opps, :won_hands,
                    :total_won_chips, :total_bet_chips
                )
            """, row)
            inserted += 1

        # ~60% of players also have 3H stats
        if random.random() < 0.6:
            row3 = gen_row(name, effective_tipo, 3)
            cur.execute("""
                INSERT INTO player_stats (
                    player, table_size, total_hands,
                    vpip_hands, pfr_hands, threeb_hands, threeb_opps,
                    fold_to_3b, fold_to_3b_opps, fourb_hands, fourb_opps,
                    limp_hands, af_bets_raises, af_calls,
                    wtsd_hands, wtsd_opps, won_hands,
                    total_won_chips, total_bet_chips
                ) VALUES (
                    :player, :table_size, :total_hands,
                    :vpip_hands, :pfr_hands, :threeb_hands, :threeb_opps,
                    :fold_to_3b, :fold_to_3b_opps, :fourb_hands, :fourb_opps,
                    :limp_hands, :af_bets_raises, :af_calls,
                    :wtsd_hands, :wtsd_opps, :won_hands,
                    :total_won_chips, :total_bet_chips
                )
            """, row3)
            inserted += 1

    conn.commit()
    conn.close()
    print(f"Seeded {inserted} player_stats rows for {len(players)} players")


if __name__ == "__main__":
    main()
