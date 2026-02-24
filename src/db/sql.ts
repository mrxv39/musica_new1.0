/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\db\sql.ts
 *
 * SQLite (tauri plugin-sql)
 * - sub_strategies: payload_json + 4 columnas OR fijas:
 *   or_to_call_any, open_push, or_to_call_small, or_to_fold
 * - initDB hace migración defensiva (PRAGMA table_info + ALTER TABLE)
 */
import Database from "@tauri-apps/plugin-sql";

let _db: Database | null = null;

export const DB_URL = "sqlite:pokerboss.db";

// Buckets fijos (BB)
export const DEFAULT_BUCKETS = [
  "20_75_BB",
  "18_20_BB",
  "14_18_BB",
  "11_14_BB",
  "8_11_BB",
  "6_8_BB",
  "0_6_BB",
] as const;

export type BucketName = (typeof DEFAULT_BUCKETS)[number];

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
  unit: string; // "BB"
  payload_json: string;

  // ✅ OR ranges persistidos como 4 keys (columnas)
  or_to_call_any: string;
  open_push: string;
  or_to_call_small: string;
  or_to_fold: string;

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

async function ensureColumns(db: Database, table: string, cols: { name: string; ddl: string }[]) {
  // SQLite: no existe "ADD COLUMN IF NOT EXISTS" en todas las versiones -> lo hacemos con PRAGMA
  const info = await db.select<Array<{ name: string }>>(`PRAGMA table_info(${table});`);
  const existing = new Set((info ?? []).map((r) => String((r as any).name)));

  for (const c of cols) {
    if (existing.has(c.name)) continue;
    await db.execute(`ALTER TABLE ${table} ADD COLUMN ${c.ddl};`);
  }
}

export async function initDB(): Promise<void> {
  const db = await getDB();

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

      -- ✅ OR ranges (4 keys fijas)
      or_to_call_any TEXT NOT NULL DEFAULT '',
      open_push TEXT NOT NULL DEFAULT '',
      or_to_call_small TEXT NOT NULL DEFAULT '',
      or_to_fold TEXT NOT NULL DEFAULT '',

      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(situation_id, name),
      FOREIGN KEY (situation_id) REFERENCES situations(id) ON DELETE CASCADE
    );
  `);

  // ✅ Migración defensiva por si la tabla existe sin columnas OR
  await ensureColumns(db, "sub_strategies", [
    { name: "or_to_call_any", ddl: "or_to_call_any TEXT NOT NULL DEFAULT ''" },
    { name: "open_push", ddl: "open_push TEXT NOT NULL DEFAULT ''" },
    { name: "or_to_call_small", ddl: "or_to_call_small TEXT NOT NULL DEFAULT ''" },
    { name: "or_to_fold", ddl: "or_to_fold TEXT NOT NULL DEFAULT ''" },
  ]);
}

export async function upsertSituationKey(key: string): Promise<number> {
  const db = await getDB();

  await db.execute(
    `
    INSERT INTO situations (key, created_at, updated_at)
    VALUES (?1, datetime('now'), datetime('now'))
    ON CONFLICT(key) DO UPDATE SET updated_at = datetime('now');
  `,
    [key]
  );

  const rows = await db.select<SituationRow[]>(
    `
    SELECT id, key, created_at, updated_at
    FROM situations
    WHERE key = ?1
    LIMIT 1;
  `,
    [key]
  );

  if (!rows || rows.length === 0) throw new Error("No pude leer situation_id tras upsert.");
  return rows[0].id;
}

function parseBucketToMinMax(name: string): { min: number; max: number } {
  // "20_75_BB" -> 20, 75
  const m = name.match(/^(\d+(?:\.\d+)?)_(\d+(?:\.\d+)?)_BB$/);
  if (!m) return { min: 0, max: 0 };
  return { min: Number(m[1]), max: Number(m[2]) };
}

export async function ensureBucketsForSituation(situationId: number): Promise<void> {
  const db = await getDB();

  for (const b of DEFAULT_BUCKETS) {
    const mm = parseBucketToMinMax(b);

    await db.execute(
      `
      INSERT INTO sub_strategies (situation_id, name, stack_min, stack_max, unit, payload_json, created_at, updated_at)
      VALUES (?1, ?2, ?3, ?4, 'BB', '{}', datetime('now'), datetime('now'))
      ON CONFLICT(situation_id, name) DO NOTHING;
    `,
      [situationId, b, mm.min, mm.max]
    );
  }
}

type OrRangesLike = {
  OR_TO_CALL_ANY?: string;
  OPEN_PUSH?: string;
  OR_TO_CALL_SMALL?: string;
  OR_TO_FOLD?: string;
};

function coerceOrCols(input: any): { a: string; p: string; s: string; f: string } {
  const r: OrRangesLike = input && typeof input === "object" ? input : {};
  const a = typeof r.OR_TO_CALL_ANY === "string" ? r.OR_TO_CALL_ANY : "";
  const p = typeof r.OPEN_PUSH === "string" ? r.OPEN_PUSH : "";
  const s = typeof r.OR_TO_CALL_SMALL === "string" ? r.OR_TO_CALL_SMALL : "";
  const f = typeof r.OR_TO_FOLD === "string" ? r.OR_TO_FOLD : "";
  return { a, p, s, f };
}

/**
 * Upsert de 1 bucket/sub.
 * ✅ Además de payload_json, persiste OR en 4 columnas fijas.
 *
 * Nota: para compatibilidad, si payload.orRanges no existe pero pasas orRangesOverride, usa override.
 */
export async function upsertSubStrategy(
  situationId: number,
  name: string,
  payload: any,
  stackMin: number,
  stackMax: number,
  orRangesOverride?: OrRangesLike
): Promise<void> {
  const db = await getDB();

  const payload_json = JSON.stringify(payload ?? {});
  const fromPayload = payload?.orRanges;
  const cols = coerceOrCols(orRangesOverride ?? fromPayload ?? null);

  await db.execute(
    `
    INSERT INTO sub_strategies (
      situation_id, name, stack_min, stack_max, unit, payload_json,
      or_to_call_any, open_push, or_to_call_small, or_to_fold,
      created_at, updated_at
    )
    VALUES (
      ?1, ?2, ?3, ?4, 'BB', ?5,
      ?6, ?7, ?8, ?9,
      datetime('now'), datetime('now')
    )
    ON CONFLICT(situation_id, name) DO UPDATE SET
      payload_json = excluded.payload_json,
      stack_min = excluded.stack_min,
      stack_max = excluded.stack_max,
      unit = 'BB',

      or_to_call_any = excluded.or_to_call_any,
      open_push = excluded.open_push,
      or_to_call_small = excluded.or_to_call_small,
      or_to_fold = excluded.or_to_fold,

      updated_at = datetime('now');
  `,
    [situationId, name, stackMin, stackMax, payload_json, cols.a, cols.p, cols.s, cols.f]
  );
}

export async function listSubStrategiesBySituationKey(key: string): Promise<SubStrategyRow[]> {
  const db = await getDB();

  const rows = await db.select<SubStrategyRow[]>(
    `
    SELECT ss.*
    FROM sub_strategies ss
    JOIN situations s ON s.id = ss.situation_id
    WHERE s.key = ?1
    ORDER BY ss.stack_min DESC, ss.name ASC;
  `,
    [key]
  );

  return rows || [];
}

export async function listAllSubStrategies(): Promise<SubStrategyJoinedRow[]> {
  const db = await getDB();

  const rows = await db.select<SubStrategyJoinedRow[]>(
    `
    SELECT
      ss.*,
      s.key AS situation_key
    FROM sub_strategies ss
    JOIN situations s ON s.id = ss.situation_id
    ORDER BY s.key ASC, ss.stack_min DESC, ss.name ASC;
  `
  );

  return rows || [];
}

export function computeSituationKey_BTN_SB_BB_FISH_FISH(): string {
  return "BTN_SB_BB_FISH_FISH";
}

/**
 * Decide bucket por stack efectivo (usa p1_stack_min/p1_stack_max).
 * Si coincide con uno de los buckets fijos, lo usa; si no, cae al más cercano por min.
 */
export function pickBucketName(stackMin: number, stackMax: number): BucketName {
  const exact = `${stackMin}_${stackMax}_BB` as BucketName;
  if ((DEFAULT_BUCKETS as readonly string[]).includes(exact)) return exact;

  // fallback: elige el bucket cuyo rango contenga stackMin, o el más cercano por distancia a min.
  let best: BucketName = "20_75_BB";
  let bestScore = Number.POSITIVE_INFINITY;

  for (const b of DEFAULT_BUCKETS) {
    const mm = parseBucketToMinMax(b);
    const contains = stackMin >= mm.min && stackMin < mm.max;
    const score = contains ? 0 : Math.abs(stackMin - mm.min);
    if (score < bestScore) {
      bestScore = score;
      best = b;
    }
  }
  return best;
}

/**
 * Borrado por PK de sub_strategies.
 * Devuelve true si borró algo.
 */
export async function deleteSubStrategyById(id: number): Promise<boolean> {
  const db = await getDB();
  const res: any = await db.execute(`DELETE FROM sub_strategies WHERE id = ?1;`, [id]);
  const rowsAffected = Number((res as any)?.rowsAffected ?? 0);
  return rowsAffected > 0;
}
