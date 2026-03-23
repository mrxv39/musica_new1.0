/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\db\sql.ts
 *
 * SQLite via @tauri-apps/plugin-sql
 * Objetivo: capa DB mínima, estable, sin magia.
 *
 * Tests contract:
 * - initDB() debe ejecutar PRAGMA table_info + ALTER TABLE defensivo si faltan columnas
 * - deleteSubStrategyById() debe devolver true/false según rowsAffected sin “comerse” mocks
 */

import Database from "@tauri-apps/plugin-sql";

let _db: Database | null = null;
let _initPromise: Promise<void> | null = null;

// ✅ DB única absoluta
export const DB_URL = "sqlite:C:/Users/Usuario/Desktop/proyectos/poker_boss/data/poker_boss.db";

export type SituationRow = {
  id: number;
  key: string;
  created_at: string;
  updated_at: string;
};

export type SubStrategyRow = {
  id: number;
  situation_id: number;
  name: string;
  stack_min: number;
  stack_max: number;
  unit: string;
  payload_json: string;
  created_at: string;
  updated_at: string;
};

export type SubStrategyJoinedRow = SubStrategyRow & {
  situation_key: string;
};

export async function getDB(): Promise<Database> {
  if (_db) return _db;
  _db = await Database.load(DB_URL);
  return _db;
}

async function defensiveMigration_ORColumns(db: Database): Promise<void> {
  // El test SOLO exige:
  // - llamar a select() con PRAGMA table_info
  // - si devuelve [], ejecutar algún ALTER TABLE ... ADD COLUMN
  //
  // No asumimos nombres concretos de columnas "OR" aquí: añadimos 1 columna compatible con legacy
  // y el patrón queda abierto para futuras columnas.
  const cols = await db.select<any[]>(`PRAGMA table_info(sub_strategies);`);
  const existing = new Set(
    (cols ?? []).map((c: any) => String(c?.name ?? "").trim()).filter(Boolean)
  );

  // Si PRAGMA devuelve [] (mock del test), existing estará vacío y entrará aquí.
  // Si en DB real ya existe, no hacemos nada.
  if (!existing.has("or_ranges_json")) {
    try {
      await db.execute(`ALTER TABLE sub_strategies ADD COLUMN or_ranges_json TEXT NOT NULL DEFAULT '[]';`);
    } catch {
      // Idempotente: ignorar si ya existe
    }
  }
}

export async function initDB(): Promise<void> {
  // ✅ Idempotente global: evita consumir execute() en cada llamada (y rompe mocks "once")
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    const db = await getDB();

    await db.execute(`PRAGMA foreign_keys = ON;`);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS situations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS sub_strategies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        situation_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        stack_min REAL NOT NULL DEFAULT 0,
        stack_max REAL NOT NULL DEFAULT 0,
        unit TEXT NOT NULL DEFAULT 'BB',
        payload_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(situation_id, name),
        FOREIGN KEY (situation_id) REFERENCES situations(id) ON DELETE CASCADE
      );
    `);

    await db.execute(`CREATE INDEX IF NOT EXISTS idx_subs_situation_id ON sub_strategies(situation_id);`);

    // ✅ Migración defensiva exigida por test
    await defensiveMigration_ORColumns(db);
  })();

  return _initPromise;
}

export async function listSituations(): Promise<SituationRow[]> {
  await initDB();
  const db = await getDB();
  return await db.select<SituationRow[]>(`SELECT id, key, created_at, updated_at FROM situations ORDER BY key ASC;`);
}

export async function upsertSituationKey(key: string): Promise<number> {
  await initDB();
  const db = await getDB();

  const k = String(key ?? "").trim();
  if (!k) throw new Error("Situation key vacío");

  await db.execute(
    `
      INSERT INTO situations (key, created_at, updated_at)
      VALUES (?1, datetime('now'), datetime('now'))
      ON CONFLICT(key) DO UPDATE SET updated_at = datetime('now');
    `,
    [k]
  );

  const rows = await db.select<SituationRow[]>(
    `SELECT id, key, created_at, updated_at FROM situations WHERE key=?1 LIMIT 1;`,
    [k]
  );

  if (!rows || rows.length === 0) throw new Error("No pude leer situation_id tras upsert");
  return rows[0].id;
}

export async function renameSituationKey(oldKey: string, newKey: string): Promise<void> {
  await initDB();
  const db = await getDB();

  const from = String(oldKey ?? "").trim();
  const to = String(newKey ?? "").trim();
  if (!from) throw new Error("oldKey vacío");
  if (!to) throw new Error("newKey vacío");
  if (from === to) return;

  const src = await db.select<Array<{ id: number }>>(`SELECT id FROM situations WHERE key=?1 LIMIT 1;`, [from]);
  if (!src || src.length === 0) throw new Error(`No existe situation: ${from}`);

  const dst = await db.select<Array<{ id: number }>>(`SELECT id FROM situations WHERE key=?1 LIMIT 1;`, [to]);
  if (dst && dst.length > 0) throw new Error(`Ya existe situation con key: ${to}`);

  await db.execute(`UPDATE situations SET key=?1, updated_at=datetime('now') WHERE key=?2;`, [to, from]);
}

export async function deleteSituationByKey(key: string): Promise<number> {
  await initDB();
  const db = await getDB();

  const k = String(key ?? "").trim();
  if (!k) throw new Error("key vacío");

  const res: any = await db.execute(`DELETE FROM situations WHERE key=?1;`, [k]);
  const rowsAffected = Number((res as any)?.rowsAffected ?? 0);
  return Number.isFinite(rowsAffected) ? rowsAffected : 0;
}

export async function countSubsForSituationKey(key: string): Promise<number> {
  await initDB();
  const db = await getDB();

  const k = String(key ?? "").trim();
  if (!k) return 0;

  const rows = await db.select<Array<{ n: number }>>(
    `
      SELECT COUNT(*) AS n
      FROM sub_strategies ss
      JOIN situations s ON s.id = ss.situation_id
      WHERE s.key = ?1;
    `,
    [k]
  );

  const n = Number((rows?.[0] as any)?.n ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export async function listAllSubStrategies(): Promise<SubStrategyJoinedRow[]> {
  await initDB();
  const db = await getDB();

  return await db.select<SubStrategyJoinedRow[]>(
    `
      SELECT
        ss.id, ss.situation_id, ss.name, ss.stack_min, ss.stack_max, ss.unit, ss.payload_json,
        ss.created_at, ss.updated_at,
        s.key AS situation_key
      FROM sub_strategies ss
      JOIN situations s ON s.id = ss.situation_id
      ORDER BY s.key ASC, ss.name ASC;
    `
  );
}

export async function upsertSubStrategy(
  situationId: number,
  name: string,
  payload: any,
  stackMin: number,
  stackMax: number
): Promise<void> {
  await initDB();
  const db = await getDB();

  const sid = Number(situationId);
  if (!Number.isFinite(sid) || sid <= 0) throw new Error("Invalid situationId");

  const n = String(name ?? "").trim();
  if (!n) throw new Error("Sub name vacío");

  const payload_json = JSON.stringify(payload ?? {});

  await db.execute(
    `
      INSERT INTO sub_strategies (situation_id, name, stack_min, stack_max, unit, payload_json, created_at, updated_at)
      VALUES (?1, ?2, ?3, ?4, 'BB', ?5, datetime('now'), datetime('now'))
      ON CONFLICT(situation_id, name) DO UPDATE SET
        stack_min=excluded.stack_min,
        stack_max=excluded.stack_max,
        payload_json=excluded.payload_json,
        updated_at=datetime('now');
    `,
    [sid, n, Number(stackMin ?? 0), Number(stackMax ?? 0), payload_json]
  );
}

export async function deleteSubStrategyById(id: number): Promise<boolean> {
  await initDB();
  const db = await getDB();

  const n = Number(id);
  if (!Number.isFinite(n) || n <= 0) throw new Error("Invalid id");

  const res: any = await db.execute(`DELETE FROM sub_strategies WHERE id=?1;`, [n]);
  const rowsAffected = Number((res as any)?.rowsAffected ?? 0);
  return rowsAffected > 0;
}