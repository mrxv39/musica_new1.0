/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\pages\strategy\db.ts
 *
 * SQLite real vía Tauri (tauri-plugin-sql).
 *
 * Nota importante para tests:
 * - Los tests de UI mockean este módulo completo, así que podemos implementar esto sin romper vitest.
 */

import type Database from "@tauri-apps/plugin-sql";
import type { StrategyStore, SubStrategyItem } from "../../strategy/types";

// ✅ Ruta relativa a BaseDirectory::AppConfig (según docs del plugin SQL)
export const DB_URL = "sqlite:poker_boss.db";

let _db: Database | null = null;

function hasTauri(): boolean {
  try {
    return typeof window !== "undefined" && !!(window as any).__TAURI__;
  } catch {
    return false;
  }
}

function lsKey(globalName: string) {
  return `poker_boss:strategy_store:${globalName}`;
}

async function loadDb(): Promise<Database> {
  if (_db) return _db;

  // Evita explotar en entornos sin Tauri.
  if (!hasTauri()) {
    throw new Error("Tauri no disponible");
  }

  const mod = await import("@tauri-apps/plugin-sql");
  const DatabaseCtor = mod.default;
  _db = await DatabaseCtor.load(DB_URL);
  return _db;
}

export async function dbInit(): Promise<void> {
  if (!hasTauri()) return;
  const db = await loadDb();

  await db.execute(`
    CREATE TABLE IF NOT EXISTS strategy_globals (
      name TEXT PRIMARY KEY,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS strategy_subs (
      id TEXT PRIMARY KEY,
      global_name TEXT NOT NULL,
      name TEXT NOT NULL DEFAULT '',
      payload_json TEXT NOT NULL DEFAULT '{}',
      or_ranges_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (global_name) REFERENCES strategy_globals(name) ON DELETE CASCADE
    );
  `);

  // Índice para listados
  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_strategy_subs_global_updated
    ON strategy_subs(global_name, updated_at);
  `);
}

type DbSubRow = {
  id: string;
  global_name: string;
  name: string;
  payload_json: string;
  or_ranges_json: string;
};

export async function dbLoadSubs(globalName: string): Promise<StrategyStore> {
  // Fallback browser (sin Tauri): localStorage
  if (!hasTauri()) {
    try {
      const raw = window.localStorage.getItem(lsKey(globalName)) || "";
      const parsed = raw ? (JSON.parse(raw) as StrategyStore) : null;
      if (parsed && typeof parsed === "object") return parsed;
    } catch {
      // ignore
    }
    return {
      version: 1,
      globals: {
        [globalName]: { name: globalName as any, subs: [] } as any,
      },
    } as any;
  }

  const db = await loadDb();
  await dbInit();

  // asegura global
  await db.execute(
    `
      INSERT INTO strategy_globals (name, created_at, updated_at)
      VALUES (?1, datetime('now'), datetime('now'))
      ON CONFLICT(name) DO UPDATE SET updated_at = datetime('now');
    `,
    [globalName]
  );

  const rows = await db.select<DbSubRow[]>(
    `
      SELECT id, global_name, name, payload_json, or_ranges_json
      FROM strategy_subs
      WHERE global_name = ?1
      ORDER BY updated_at DESC;
    `,
    [globalName]
  );

  const subs: SubStrategyItem[] = (rows || []).map((r) => {
    let payload: any = {};
    let or_ranges: any = [];
    try {
      payload = JSON.parse(r.payload_json || "{}");
    } catch {
      payload = {};
    }
    try {
      or_ranges = JSON.parse(r.or_ranges_json || "[]");
    } catch {
      or_ranges = [];
    }

    return {
      id: r.id,
      name: r.name,
      payload,
      or_ranges,
    } as any;
  });

  return {
    version: 1,
    globals: {
      [globalName]: {
        name: globalName as any,
        subs,
      } as any,
    },
  } as StrategyStore;
}

export async function dbSaveSub(item: SubStrategyItem & { globalName?: string }): Promise<void> {
  const globalName = (item as any).globalName;
  if (!globalName) throw new Error("globalName requerido para guardar");

  // Fallback browser (sin Tauri): localStorage
  if (!hasTauri()) {
    const store = await dbLoadSubs(globalName);
    const subs = (store.globals?.[globalName] as any)?.subs ?? [];
    const nextSubs = [
      // remove existing id
      ...subs.filter((s: any) => String(s.id) !== String(item.id)),
      {
        id: String(item.id),
        name: String((item as any).name ?? ""),
        payload: (item as any).payload ?? {},
        or_ranges: (item as any).or_ranges ?? [],
      },
    ];
    const next: StrategyStore = {
      version: 1,
      globals: {
        ...(store.globals ?? {}),
        [globalName]: { name: globalName as any, subs: nextSubs } as any,
      },
    } as any;
    window.localStorage.setItem(lsKey(globalName), JSON.stringify(next));
    return;
  }

  const db = await loadDb();
  await dbInit();

  await db.execute(
    `
      INSERT INTO strategy_globals (name, created_at, updated_at)
      VALUES (?1, datetime('now'), datetime('now'))
      ON CONFLICT(name) DO UPDATE SET updated_at = datetime('now');
    `,
    [globalName]
  );

  const payload_json = JSON.stringify((item as any).payload ?? {});
  const or_ranges_json = JSON.stringify((item as any).or_ranges ?? []);
  const name = String((item as any).name ?? "");

  await db.execute(
    `
      INSERT INTO strategy_subs (id, global_name, name, payload_json, or_ranges_json, created_at, updated_at)
      VALUES (?1, ?2, ?3, ?4, ?5, datetime('now'), datetime('now'))
      ON CONFLICT(id) DO UPDATE SET
        global_name = excluded.global_name,
        name = excluded.name,
        payload_json = excluded.payload_json,
        or_ranges_json = excluded.or_ranges_json,
        updated_at = datetime('now');
    `,
    [String(item.id), globalName, name, payload_json, or_ranges_json]
  );
}
