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

import { getDB } from "./sql";

let _initPlayersPromise: Promise<void> | null = null;

export type PlayerRow = {
  id: number;
  name: string;
  tipo: string;
  created_at: string;
};

export async function initPlayersDB(): Promise<void> {
  if (_initPlayersPromise) return _initPlayersPromise;

  _initPlayersPromise = (async () => {
    const db = await getDB();

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

    // Índice útil
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
  const db = await getDB();

  return (await db.select(
    `SELECT id, name, tipo, created_at FROM players ORDER BY name ASC;`
  )) as PlayerRow[];
}

export async function updatePlayerTipo(
  playerId: number,
  tipo: string
): Promise<void> {
  await initPlayersDB();
  const db = await getDB();

  const id = Number(playerId);
  if (!Number.isFinite(id) || id <= 0) throw new Error("Invalid playerId");

  const t = String(tipo ?? "").trim();
  if (!t) throw new Error("tipo vacío");

  await db.execute(`UPDATE players SET tipo=?1 WHERE id=?2;`, [t, id]);
}