/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\db\players.ts
 *
 * CRUD for players with hand_players join and player_aliases.
 *
 * Tables:
 *   players(id, name, tipo, notes, created_at)
 *   hand_players(id, hand_id, player_id, seat, chips, is_dealer, win)
 *   player_aliases(id, alias, player_id, source, created_at)
 */

import Database from "@tauri-apps/plugin-sql";
import { getPlayersDbUrl } from "../config";

let _playersDb: Database | null = null;
let _initPlayersPromise: Promise<void> | null = null;

export const PLAYERS_DB_URL = getPlayersDbUrl();

export type PlayerRow = {
  id: number;
  name: string;
  tipo: string;
  notes: string;
  created_at: string;
  hand_count: number;
  tournament_count: number;
};

export type PlayerAlias = {
  id: number;
  alias: string;
  player_id: number;
  source: string;
};

async function getPlayersDB(): Promise<Database> {
  if (_playersDb) return _playersDb;
  _playersDb = await Database.load(PLAYERS_DB_URL);
  return _playersDb;
}

export async function initPlayersDB(): Promise<void> {
  if (_initPlayersPromise) return _initPlayersPromise;

  _initPlayersPromise = (async () => {
    const db = await getPlayersDB();
    await db.execute(`PRAGMA foreign_keys = ON;`);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS players (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        tipo TEXT NOT NULL DEFAULT 'fish',
        notes TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);

    await db.execute(`
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
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS player_aliases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        alias TEXT UNIQUE NOT NULL,
        player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
        source TEXT NOT NULL DEFAULT 'manual',
        created_at TEXT DEFAULT (datetime('now'))
      );
    `);

    // Defensive: add notes column if missing
    const cols = (await db.select(`PRAGMA table_info(players);`)) as any[];
    const existing = new Set(
      (cols ?? []).map((c: any) => String(c?.name ?? "").trim()).filter(Boolean)
    );
    if (!existing.has("notes")) {
      try {
        await db.execute(`ALTER TABLE players ADD COLUMN notes TEXT NOT NULL DEFAULT '';`);
      } catch { /* idempotent */ }
    }

    try {
      await db.execute(`CREATE INDEX IF NOT EXISTS idx_hand_players_hand ON hand_players(hand_id);`);
      await db.execute(`CREATE INDEX IF NOT EXISTS idx_hand_players_player ON hand_players(player_id);`);
      await db.execute(`CREATE INDEX IF NOT EXISTS idx_player_aliases_player ON player_aliases(player_id);`);
    } catch { /* ignore */ }
  })();

  return _initPlayersPromise;
}

export async function listPlayers(): Promise<PlayerRow[]> {
  await initPlayersDB();
  const db = await getPlayersDB();

  return (await db.select(`
    SELECT
      p.id, p.name, p.tipo, p.notes, p.created_at,
      COALESCE(hp.hand_count, 0) as hand_count,
      COALESCE(tc.tournament_count, 0) as tournament_count
    FROM players p
    LEFT JOIN (
      SELECT player_id, COUNT(*) as hand_count
      FROM hand_players GROUP BY player_id
    ) hp ON hp.player_id = p.id
    LEFT JOIN (
      SELECT hp2.player_id, COUNT(DISTINCT h.tournament_id) as tournament_count
      FROM hand_players hp2
      JOIN hands h ON h.id = hp2.hand_id
      WHERE h.tournament_id IS NOT NULL
      GROUP BY hp2.player_id
    ) tc ON tc.player_id = p.id
    ORDER BY hand_count DESC, p.name ASC;
  `)) as PlayerRow[];
}

export async function updatePlayerTipo(
  playerId: number,
  tipo: string
): Promise<void> {
  await initPlayersDB();
  const db = await getPlayersDB();

  const id = Number(playerId);
  if (!Number.isFinite(id) || id <= 0) throw new Error("Invalid playerId");

  const t = String(tipo ?? "").trim();
  if (!t) throw new Error("tipo vacío");

  await db.execute(`UPDATE players SET tipo=?1 WHERE id=?2;`, [t, id]);
}

export async function updatePlayerNotes(
  playerId: number,
  notes: string
): Promise<void> {
  await initPlayersDB();
  const db = await getPlayersDB();

  const id = Number(playerId);
  if (!Number.isFinite(id) || id <= 0) throw new Error("Invalid playerId");

  await db.execute(`UPDATE players SET notes=?1 WHERE id=?2;`, [String(notes ?? ""), id]);
}

export async function updatePlayerTipoByName(
  name: string,
  tipo: string
): Promise<void> {
  await initPlayersDB();
  const db = await getPlayersDB();
  const n = String(name ?? "").trim();
  const t = String(tipo ?? "").trim();
  if (!n || !t) return;
  await db.execute(`UPDATE players SET tipo=?1 WHERE name=?2;`, [t, n]);
}

export async function listAliases(playerId: number): Promise<PlayerAlias[]> {
  await initPlayersDB();
  const db = await getPlayersDB();
  return (await db.select(
    `SELECT id, alias, player_id, source FROM player_aliases WHERE player_id=?1 ORDER BY alias;`,
    [playerId]
  )) as PlayerAlias[];
}

export async function addAlias(playerId: number, alias: string): Promise<void> {
  await initPlayersDB();
  const db = await getPlayersDB();
  const a = String(alias ?? "").trim();
  if (!a) return;
  await db.execute(
    `INSERT OR IGNORE INTO player_aliases (alias, player_id, source) VALUES (?1, ?2, 'manual');`,
    [a, playerId]
  );
}

export async function removeAlias(aliasId: number): Promise<void> {
  await initPlayersDB();
  const db = await getPlayersDB();
  await db.execute(`DELETE FROM player_aliases WHERE id=?1;`, [aliasId]);
}

export async function resetPlayersTable(): Promise<void> {
  await initPlayersDB();
  const db = await getPlayersDB();
  await db.execute(`DELETE FROM hand_players;`);
  await db.execute(`DELETE FROM player_aliases;`);
  await db.execute(`DELETE FROM players;`);
}
