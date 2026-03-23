/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\test\sql.dbpath.persistence.test.ts
 *
 * Este test garantiza:
 * - La DB URL usada por getDB() es EXACTAMENTE poker_boss.db (ruta absoluta)
 * - initDB ejecuta CREATE TABLE + migración defensiva
 * - upsertSituationKey hace INSERT + SELECT
 * - deleteSubStrategyById devuelve true/false según rowsAffected
 *
 * Nota: no requiere sqlite3. Mockeamos @tauri-apps/plugin-sql y validamos que
 * el código ejecuta SQL contra la DB correcta.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const EXPECTED_DB_URL = "sqlite:C:/Users/Usuario/Desktop/proyectos/poker_boss/data/poker_boss.db";

// --- Mock del plugin-sql ---
const execute = vi.fn(async () => ({ rowsAffected: 1 }));
const select = vi.fn(async (q: string) => {
  // PRAGMA table_info -> devuelve columnas ya existentes (vacío para forzar ALTERs si quieres)
  if (String(q).includes("PRAGMA table_info")) return [];
  // SELECT situation after upsert
  if (String(q).includes("FROM situations") && String(q).includes("WHERE key")) {
    return [{ id: 123, key: "X", created_at: "t", updated_at: "t" }];
  }
  return [];
});

const load = vi.fn(async (url: string) => {
  return {
    execute,
    select,
  } as any;
});

vi.mock("@tauri-apps/plugin-sql", () => {
  return {
    default: {
      load,
    },
  };
});

describe("sql.ts uses poker_boss.db and persists via SQL", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Import dinámico para que el mock se aplique limpio
    const mod = await import("../db/sql");
    // sanity: DB_URL exportado correcto
    expect(mod.DB_URL).toBe(EXPECTED_DB_URL);
  });

  it("getDB() opens EXACT db url", async () => {
    const { getDB } = await import("../db/sql");
    await getDB();
    expect(load).toHaveBeenCalledTimes(1);
    expect(load).toHaveBeenCalledWith(EXPECTED_DB_URL);
  });

  it("initDB() creates tables and runs defensive migration", async () => {
    const { initDB } = await import("../db/sql");
    await initDB();

    const calls = execute.mock.calls.map((c) => String(c[0]));
    expect(calls.join("\n")).toContain("CREATE TABLE IF NOT EXISTS situations");
    expect(calls.join("\n")).toContain("CREATE TABLE IF NOT EXISTS sub_strategies");

    // PRAGMA check for columns
    expect(select).toHaveBeenCalled();
    // ALTER TABLE for OR columns (because PRAGMA returned [])
    expect(calls.join("\n")).toContain("ALTER TABLE sub_strategies ADD COLUMN");
  });

  it("upsertSituationKey() runs INSERT then SELECT and returns id", async () => {
    const { upsertSituationKey } = await import("../db/sql");
    const id = await upsertSituationKey("X");
    expect(id).toBe(123);

    const execCalls = execute.mock.calls.map((c) => String(c[0]));
    expect(execCalls.join("\n")).toContain("INSERT INTO situations");
    const selCalls = select.mock.calls.map((c) => String(c[0]));
    expect(selCalls.join("\n")).toContain("FROM situations");
  });

  it("deleteSubStrategyById() returns true when rowsAffected > 0", async () => {
    const { deleteSubStrategyById } = await import("../db/sql");

    execute.mockResolvedValueOnce({ rowsAffected: 1 });
    await expect(deleteSubStrategyById(10)).resolves.toBe(true);

    execute.mockResolvedValueOnce({ rowsAffected: 0 });
    await expect(deleteSubStrategyById(11)).resolves.toBe(false);
  });
});
