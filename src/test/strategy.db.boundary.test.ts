/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\test\strategy.db.boundary.test.ts
 *
 * Test unitario para blindar el boundary de DB:
 * - dbLoadSubs() debe mapear ids como "db_<id>"
 * - dbDeleteSub("db_<id>") debe invocar deleteSubStrategyById(<id>) y fallar si no borra
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../db/sql", () => {
  return {
    initDB: vi.fn(async () => {}),
    listAllSubStrategies: vi.fn(async () => [
      {
        id: 7,
        situation_id: 1,
        name: "20_75_BB",
        stack_min: 20,
        stack_max: 75,
        unit: "BB",
        payload_json: "{}",
        or_to_call_any: "",
        open_push: "",
        or_to_call_small: "",
        or_to_fold: "",
        created_at: "t",
        updated_at: "t",
        situation_key: "BTN_SB_BB_FISH_FISH",
      },
    ]),
    pickBucketName: vi.fn(() => "20_75_BB"),
    upsertSituationKey: vi.fn(async () => 1),
    ensureBucketsForSituation: vi.fn(async () => {}),
    upsertSubStrategy: vi.fn(async () => {}),
    deleteSubStrategyById: vi.fn(async (id: number) => id === 7),
  };
});

describe("pages/strategy/db.ts boundary", () => {
  beforeEach(() => vi.clearAllMocks());

  it("dbLoadSubs maps row id -> ui id db_<id>", async () => {
    const { dbLoadSubs } = await import("../pages/strategy/db");
    const store = await dbLoadSubs("GLOBAL");
    const subs = (store as any).globals.GLOBAL.subs;
    expect(Array.isArray(subs)).toBe(true);
    expect(subs[0].id).toBe("db_7");
  });

  it("dbDeleteSub parses db_<id> and calls deleteSubStrategyById(<id>)", async () => {
    const { dbDeleteSub } = await import("../pages/strategy/db");
    await expect(dbDeleteSub("db_7")).resolves.toBeUndefined();
  });

  it("dbDeleteSub throws if invalid id format", async () => {
    const { dbDeleteSub } = await import("../pages/strategy/db");
    await expect(dbDeleteSub("7" as any)).rejects.toThrow(/Invalid sub id/);
  });

  it("dbDeleteSub throws if delete returns false", async () => {
    const { dbDeleteSub } = await import("../pages/strategy/db");
    await expect(dbDeleteSub("db_999")).rejects.toThrow(/Not found/);
  });
});
