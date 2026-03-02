import { describe, it, expect, vi, beforeEach } from "vitest";
import sqlite3 from "sqlite3";

// Fake DB compatible con la API usada en src/db/spots.ts (select/execute)
function makeFakeDB(dbFile: string) {
  const db = new sqlite3.Database(dbFile);

  function execRun(sql: string, params: any[] = []) {
    return new Promise<{ rowsAffected: number }>((resolve, reject) => {
      db.run(sql, params, function (err) {
        if (err) return reject(err);
        resolve({ rowsAffected: (this as any).changes ?? 0 });
      });
    });
  }

  function execAll(sql: string, params: any[] = []) {
    return new Promise<any[]>((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) return reject(err);
        resolve(rows ?? []);
      });
    });
  }

  return {
    close: () => new Promise<void>((res) => db.close(() => res())),
    execute: async (sql: string, params?: any[]) => execRun(sql, params ?? []),
    select: async <T = any[]>(sql: string, params?: any[]) =>
      (await execAll(sql, params ?? [])) as any as T,
  };
}

beforeEach(async () => {
  // IMPORTANT: evita fugas de mocks de otros tests (UI) que mockean ../db/spots
  vi.clearAllMocks();
  vi.resetModules();
  vi.unmock("../db/spots");
  vi.unmock("../db/sql");
});

describe("spots repo persistence (contract)", () => {
  it("updateStrategyPayload persists payload_json and can be read back", async () => {
    // Mock de getDB() para que spots.ts no use Tauri plugin
    vi.doMock("../db/sql", async () => {
      const path = await import("node:path");
      const os = await import("node:os");
      const fs = await import("node:fs");

      const tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), "spotsdb-"));
      const dbFile = path.join(tmpdir, "test.sqlite");

      const fake = makeFakeDB(dbFile);

      return {
        getDB: async () => fake,
        DB_URL: "sqlite:TEST",
      };
    });

    // Import REAL del módulo (ya sin mock “colado”)
    const spots = await import("../db/spots");

    await spots.initSpotsDB();

    await spots.createSpot("S1");
    const spotsList = await spots.listSpots();
    const spotId = spotsList[0].id;

    await spots.createStrategy(spotId, "A", {}); // empieza vacío
    const list1 = await spots.listStrategiesForSpot(spotId);
    expect(list1.length).toBe(1);

    const id = list1[0].id;

    const payload = {
      p1: { bet_min: 9 },
      or_blocks: { OR_TO_CALL_ANY: { min: 1, max: 2, range: "AA" } },
    };

    await spots.updateStrategyPayload(id, payload);

    const row = await spots.getStrategyById(id);
    expect(row).toBeTruthy();

    const parsed = JSON.parse((row as any).payload_json);
    expect(parsed.p1.bet_min).toBe(9);
    expect(parsed.or_blocks.OR_TO_CALL_ANY.range).toBe("AA");
  });
});
