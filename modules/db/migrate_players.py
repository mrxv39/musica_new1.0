"""
Migration: rebuild players table from XML hand histories.

1. Create hand_players and player_aliases tables
2. Extract real villain names from hands.players_json
3. Repopulate players with canonical names
4. Populate hand_players join table
5. Auto-generate aliases from OCR observations (spots, workers_captures)
"""

import json
import sqlite3
import sys
import os

# Allow running as standalone script
if __name__ == "__main__":
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "data", "poker_boss.db")
HERO = "xavieeee2"


def get_conn(db_path: str = DB_PATH) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def migrate_players(conn: sqlite3.Connection, hero: str = HERO, dry_run: bool = False):
    """Main migration: clean players, create joins, extract from XML."""

    cur = conn.cursor()

    # ── Step 0: Create new tables if not exist ──
    cur.executescript("""
        CREATE TABLE IF NOT EXISTS hand_players (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            hand_id INTEGER NOT NULL REFERENCES hands(id) ON DELETE CASCADE,
            player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
            seat INTEGER DEFAULT 0,
            chips REAL DEFAULT 0,
            is_dealer INTEGER DEFAULT 0,
            win REAL DEFAULT 0,
            UNIQUE(hand_id, player_id)
        );
        CREATE INDEX IF NOT EXISTS idx_hand_players_hand ON hand_players(hand_id);
        CREATE INDEX IF NOT EXISTS idx_hand_players_player ON hand_players(player_id);

        CREATE TABLE IF NOT EXISTS player_aliases (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            alias TEXT UNIQUE NOT NULL,
            player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
            source TEXT NOT NULL DEFAULT 'manual',
            created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_player_aliases_player ON player_aliases(player_id);
    """)

    # Add notes column to players if missing
    cols = {r[1] for r in cur.execute("PRAGMA table_info(players)").fetchall()}
    if "notes" not in cols:
        cur.execute("ALTER TABLE players ADD COLUMN notes TEXT NOT NULL DEFAULT ''")

    # ── Step 1: Extract unique villain names from hands.players_json ──
    villain_names: set[str] = set()
    rows = cur.execute("SELECT id, players_json FROM hands WHERE players_json != ''").fetchall()

    hand_player_data: list[tuple] = []  # (hand_id, name, seat, chips, is_dealer, win)

    for hand_id, pj_raw in rows:
        try:
            data = json.loads(pj_raw)
            players = data if isinstance(data, list) else data.get("players", [])
        except (json.JSONDecodeError, TypeError):
            continue

        for i, p in enumerate(players):
            name = (p.get("name") or "").strip()
            if not name:
                continue

            chips = _parse_num(p.get("chips", 0))
            is_dealer = 1 if str(p.get("dealer", "0")) == "1" else 0
            win = _parse_num(p.get("win", 0))

            if name.lower() == hero.lower():
                continue  # skip hero

            villain_names.add(name)
            hand_player_data.append((hand_id, name, i, chips, is_dealer, win))

    print(f"Found {len(villain_names)} unique villains from {len(rows)} hands")
    for n in sorted(villain_names):
        print(f"  {n}")

    if dry_run:
        print("\n[DRY RUN] No changes made.")
        return

    # ── Step 2: Clean players table, repopulate with real names ──
    # Save existing tipo assignments
    old_tipos = {}
    for row in cur.execute("SELECT name, tipo FROM players").fetchall():
        old_tipos[row[0].lower()] = row[1]

    cur.execute("DELETE FROM players")
    cur.execute("DELETE FROM sqlite_sequence WHERE name='players'")

    for name in sorted(villain_names):
        # Preserve tipo if we had it for this exact name
        tipo = old_tipos.get(name.lower(), "fish")
        cur.execute(
            "INSERT INTO players (name, tipo) VALUES (?, ?)",
            (name, tipo),
        )

    # Build name→id map
    name_to_id: dict[str, int] = {}
    for row in cur.execute("SELECT id, name FROM players").fetchall():
        name_to_id[row[1]] = row[0]

    print(f"\nInserted {len(name_to_id)} players")

    # ── Step 3: Populate hand_players ──
    cur.execute("DELETE FROM hand_players")
    inserted_hp = 0
    for hand_id, name, seat, chips, is_dealer, win in hand_player_data:
        pid = name_to_id.get(name)
        if pid is None:
            continue
        try:
            cur.execute(
                "INSERT OR IGNORE INTO hand_players (hand_id, player_id, seat, chips, is_dealer, win) VALUES (?,?,?,?,?,?)",
                (hand_id, pid, seat, chips, is_dealer, win),
            )
            inserted_hp += 1
        except sqlite3.IntegrityError:
            pass

    print(f"Inserted {inserted_hp} hand_players rows")

    # ── Step 4: Clean player_aliases ──
    cur.execute("DELETE FROM player_aliases")
    print("\nAliases table cleared (add OCR aliases manually or via auto-detect)")

    conn.commit()
    print("\nMigration complete!")

    # ── Summary ──
    print("\n=== Summary ===")
    pc = cur.execute("SELECT COUNT(*) FROM players").fetchone()[0]
    hpc = cur.execute("SELECT COUNT(*) FROM hand_players").fetchone()[0]
    print(f"  players: {pc}")
    print(f"  hand_players: {hpc}")
    print(f"  player_aliases: 0 (add via UI or script)")


def _parse_num(val) -> float:
    """Parse a number from string, handling commas."""
    if isinstance(val, (int, float)):
        return float(val)
    try:
        return float(str(val).replace(",", "").strip())
    except (ValueError, TypeError):
        return 0.0


if __name__ == "__main__":
    dry = "--dry-run" in sys.argv
    db = DB_PATH
    for i, arg in enumerate(sys.argv):
        if arg == "--db" and i + 1 < len(sys.argv):
            db = sys.argv[i + 1]

    print(f"DB: {db}")
    print(f"Hero: {HERO}")
    print(f"Dry run: {dry}\n")

    conn = get_conn(db)
    migrate_players(conn, hero=HERO, dry_run=dry)
    conn.close()
