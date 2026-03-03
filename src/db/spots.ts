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
  payload_json: string;
  created_at: string;
};

async function defensiveMigration_StrategyPayload(db: any): Promise<void> {
  // Contract del test: que exista strategies.payload_json (TEXT)
  const cols = (await db.select(`PRAGMA table_info(strategies);`)) as any[];
  const existing = new Set(
    (cols ?? []).map((c: any) => String(c?.name ?? "").trim()).filter(Boolean)
  );

  if (!existing.has("payload_json")) {
    try {
      await db.execute(
        `ALTER TABLE strategies ADD COLUMN payload_json TEXT NOT NULL DEFAULT '{}';`
      );
    } catch {
      // idempotente
    }
  }
}

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
        payload_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (spot_id) REFERENCES spots(id) ON DELETE CASCADE
      );
    `);

    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_strategies_spot_id
      ON strategies(spot_id);
    `);

    // ✅ Migración defensiva (por si la tabla existía sin payload_json)
    await defensiveMigration_StrategyPayload(db);
  })();

  return _initSpotsPromise;
}

/* ---------------------- SPOTS CRUD ---------------------- */

export async function listSpots(): Promise<SpotRow[]> {
  await initSpotsDB();
  const db = await getDB();
  return (await db.select(
    `SELECT id, name, description, created_at FROM spots ORDER BY name ASC;`
  )) as SpotRow[];
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

  const res: any = await db.execute(`DELETE FROM spots WHERE id=?1;`, [n]);
  return Number(res?.rowsAffected ?? 0) > 0;
}

/* ------------------- STRATEGIES CRUD ------------------- */

export async function listStrategiesForSpot(spotId: number): Promise<StrategyRow[]> {
  await initSpotsDB();
  const db = await getDB();

  const n = Number(spotId);
  if (!Number.isFinite(n) || n <= 0) return [];

  return (await db.select(
    `
      SELECT id, spot_id, name, description, payload_json, created_at
      FROM strategies
      WHERE spot_id=?1
      ORDER BY name ASC;
    `,
    [n]
  )) as StrategyRow[];
}

/**
 * Compat:
 * - createStrategy(spotId, name, {} )  => payload inicial (contract test)
 * - createStrategy(spotId, name, "desc") => description legacy
 */
export async function createStrategy(
  spotId: number,
  name: string,
  payloadOrDescription?: any
): Promise<void> {
  await initSpotsDB();
  const db = await getDB();

  const sid = Number(spotId);
  if (!Number.isFinite(sid) || sid <= 0) throw new Error("Invalid spotId");

  const n = String(name ?? "").trim();
  if (!n) throw new Error("Strategy name vacío");

  let description: string | null = null;
  let payload: any = {};

  if (typeof payloadOrDescription === "string") {
    description = payloadOrDescription;
    payload = {};
  } else if (payloadOrDescription && typeof payloadOrDescription === "object") {
    description = null;
    payload = payloadOrDescription;
  } else {
    description = null;
    payload = {};
  }

  const payload_json = JSON.stringify(payload ?? {});

  await db.execute(
    `
      INSERT INTO strategies (spot_id, name, description, payload_json, created_at)
      VALUES (?1, ?2, ?3, ?4, datetime('now'));
    `,
    [sid, n, description, payload_json]
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

  const res: any = await db.execute(`DELETE FROM strategies WHERE id=?1;`, [n]);
  return Number(res?.rowsAffected ?? 0) > 0;
}

/* ------------------- CONTRACT: payload persistence ------------------- */

export async function updateStrategyPayload(id: number, payload: any): Promise<void> {
  await initSpotsDB();
  const db = await getDB();

  const n = Number(id);
  if (!Number.isFinite(n) || n <= 0) throw new Error("Invalid strategy id");

  const payload_json = JSON.stringify(payload ?? {});

  await db.execute(
    `
      UPDATE strategies
      SET payload_json=?1
      WHERE id=?2;
    `,
    [payload_json, n]
  );
}

export async function getStrategyById(id: number): Promise<StrategyRow | null> {
  await initSpotsDB();
  const db = await getDB();

  const n = Number(id);
  if (!Number.isFinite(n) || n <= 0) return null;

  const rows = (await db.select(
    `
      SELECT id, spot_id, name, description, payload_json, created_at
      FROM strategies
      WHERE id=?1
      LIMIT 1;
    `,
    [n]
  )) as StrategyRow[];

  return rows && rows.length > 0 ? rows[0] : null;
}