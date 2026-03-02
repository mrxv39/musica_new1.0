/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\db\spots.ts
 *
 * CRUD independiente para:
 * - spots
 * - strategies
 *
 * No modifica sql.ts
 * No afecta strategy
 * Arquitectura paralela estable
 */

import { getDB } from "./sql";

let _initSpotsPromise: Promise<void> | null = null;

export type SpotRow = {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
};

export type StrategyRow = {
  id: number;
  spot_id: number;
  name: string;
  description: string | null;
  created_at: string;
};

export async function initSpotsDB(): Promise<void> {
  if (_initSpotsPromise) return _initSpotsPromise;

  _initSpotsPromise = (async () => {
    const db = await getDB();

    await db.execute(`PRAGMA foreign_keys = ON;`);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS spots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS strategies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        spot_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (spot_id) REFERENCES spots(id) ON DELETE CASCADE
      );
    `);

    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_strategies_spot_id
      ON strategies(spot_id);
    `);
  })();

  return _initSpotsPromise;
}

/* ---------------------- SPOTS CRUD ---------------------- */

export async function listSpots(): Promise<SpotRow[]> {
  await initSpotsDB();
  const db = await getDB();
  return await db.select<SpotRow[]>(
    `SELECT id, name, description, created_at FROM spots ORDER BY name ASC;`
  );
}

export async function createSpot(name: string, description?: string): Promise<void> {
  await initSpotsDB();
  const db = await getDB();

  const n = String(name ?? "").trim();
  if (!n) throw new Error("Spot name vacío");

  await db.execute(
    `
      INSERT INTO spots (name, description, created_at)
      VALUES (?1, ?2, datetime('now'));
    `,
    [n, description ?? null]
  );
}

export async function updateSpot(id: number, name: string, description?: string): Promise<void> {
  await initSpotsDB();
  const db = await getDB();

  const n = Number(id);
  if (!Number.isFinite(n) || n <= 0) throw new Error("Invalid spot id");

  const nm = String(name ?? "").trim();
  if (!nm) throw new Error("Spot name vacío");

  await db.execute(
    `
      UPDATE spots
      SET name=?1, description=?2
      WHERE id=?3;
    `,
    [nm, description ?? null, n]
  );
}

export async function deleteSpot(id: number): Promise<boolean> {
  await initSpotsDB();
  const db = await getDB();

  const n = Number(id);
  if (!Number.isFinite(n) || n <= 0) throw new Error("Invalid spot id");

  const res: any = await db.execute(
    `DELETE FROM spots WHERE id=?1;`,
    [n]
  );

  return Number(res?.rowsAffected ?? 0) > 0;
}

/* ------------------- STRATEGIES CRUD ------------------- */

export async function listStrategiesForSpot(spotId: number): Promise<StrategyRow[]> {
  await initSpotsDB();
  const db = await getDB();

  const n = Number(spotId);
  if (!Number.isFinite(n) || n <= 0) return [];

  return await db.select<StrategyRow[]>(
    `
      SELECT id, spot_id, name, description, created_at
      FROM strategies
      WHERE spot_id=?1
      ORDER BY name ASC;
    `,
    [n]
  );
}

export async function createStrategy(
  spotId: number,
  name: string,
  description?: string
): Promise<void> {
  await initSpotsDB();
  const db = await getDB();

  const sid = Number(spotId);
  if (!Number.isFinite(sid) || sid <= 0) throw new Error("Invalid spotId");

  const n = String(name ?? "").trim();
  if (!n) throw new Error("Strategy name vacío");

  await db.execute(
    `
      INSERT INTO strategies (spot_id, name, description, created_at)
      VALUES (?1, ?2, ?3, datetime('now'));
    `,
    [sid, n, description ?? null]
  );
}

export async function updateStrategy(
  id: number,
  name: string,
  description?: string
): Promise<void> {
  await initSpotsDB();
  const db = await getDB();

  const n = Number(id);
  if (!Number.isFinite(n) || n <= 0) throw new Error("Invalid strategy id");

  const nm = String(name ?? "").trim();
  if (!nm) throw new Error("Strategy name vacío");

  await db.execute(
    `
      UPDATE strategies
      SET name=?1, description=?2
      WHERE id=?3;
    `,
    [nm, description ?? null, n]
  );
}

export async function deleteStrategy(id: number): Promise<boolean> {
  await initSpotsDB();
  const db = await getDB();

  const n = Number(id);
  if (!Number.isFinite(n) || n <= 0) throw new Error("Invalid strategy id");

  const res: any = await db.execute(
    `DELETE FROM strategies WHERE id=?1;`,
    [n]
  );

  return Number(res?.rowsAffected ?? 0) > 0;
}
