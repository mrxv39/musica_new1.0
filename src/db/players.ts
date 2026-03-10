/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\db\players.ts
 *
 * CRUD mínimo para players:
 * - listPlayers()
 * - updatePlayerTipo()
 *
 * Tabla esperada (según DB real):
 *   players(id INTEGER PK, name TEXT, tipo TEXT, created_at TEXT)
 */

import Database from "@tauri-apps/plugin-sql";

let _playersDb: Database | null = null;
let _initPlayersPromise: Promise<void> | null = null;

// ✅ Players debe leer la DB principal real de Poker Boss
export const PLAYERS_DB_URL =
  "sqlite:C:/Users/Usuario/Desktop/proyectos/poker_boss/data/poker_boss.db";

export type PlayerRow = {
  id: number;
  name: string;
  tipo: string;
  created_at: string;
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
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);

    // Migración defensiva: si existe tabla legacy sin columna tipo
    const cols = (await db.select(`PRAGMA table_info(players);`)) as any[];
    const existing = new Set(
      (cols ?? []).map((c: any) => String(c?.name ?? "").trim()).filter(Boolean)
    );

    if (!existing.has("tipo")) {
      try {
        await db.execute(
          `ALTER TABLE players ADD COLUMN tipo TEXT NOT NULL DEFAULT 'fish';`
        );
      } catch {
        // idempotente
      }
    }

    try {
      await db.execute(
        `CREATE INDEX IF NOT EXISTS idx_players_name ON players(name);`
      );
    } catch {
        // ignore
    }
  })();

  return _initPlayersPromise;
}

export async function listPlayers(): Promise<PlayerRow[]> {
  await initPlayersDB();
  const db = await getPlayersDB();

  return (await db.select(
    `SELECT id, name, tipo, created_at FROM players ORDER BY name ASC;`
  )) as PlayerRow[];
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