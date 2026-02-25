// C:\Users\Usuario\Desktop\proyectos\poker_boss\src\test\sql.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

// ---- Mock de @tauri-apps/plugin-sql ----
type ExecCall = { sql: string; params?: any[] };
type SelectCall = { sql: string; params?: any[] };

function makeFakeDb() {
  const executeCalls: ExecCall[] = [];
  const selectCalls: SelectCall[] = [];

  // Por defecto: upsertSituationKey hará select y devolverá id=1
  let selectQueue: any[][] = [[{ id: 1, key: "BTN_SB_BB_FISH_FISH", created_at: "", updated_at: "" }]];

  const db = {
    execute: vi.fn(async (sql: string, params?: any[]) => {
      executeCalls.push({ sql, params });
      return undefined;
    }),
    select: vi.fn(async (sql: string, params?: any[]) => {
      selectCalls.push({ sql, params });
      const next = selectQueue.shift();
      return next ?? [];
    }),

    // helpers para tests
    __getExecuteCalls: () => executeCalls,
    __getSelectCalls: () => selectCalls,
    __setSelectQueue: (q: any[][]) => {
      selectQueue = [...q];
    },
  };

  return db;
}

const fakeDb = makeFakeDb();

vi.mock("@tauri-apps/plugin-sql", () => {
  return {
    default: {
      load: vi.fn(async (_url: string) => fakeDb),
    },
  };
});

// Importar DESPUÉS del mock
import {
  DEFAULT_BUCKETS,
  initDB,
  upsertSituationKey,
  ensureBucketsForSituation,
  upsertSubStrategy,
  listSubStrategiesBySituationKey,
  pickBucketName,
} from "../db/sql";

function makeValidPayload(overrides: Partial<any> = {}) {
  return {
    spot: "BTN",
    hero_pos: "BTN",

    p1_bet_min: 0,
    p1_bet_max: 75,
    p1_stack_min: 10,
    p1_stack_max: 50,
    p1_se_min: 5,
    p1_se_max: 20,

    p2_pos: "SB",
    p2_tipo: "fish",
    p2_bet_min: 0,
    p2_bet_max: 75,
    p2_stack_min: 10,
    p2_stack_max: 50,

    p3_pos: "BB",
    p3_tipo: "fish",
    p3_bet_min: 0,
    p3_bet_max: 75,
    p3_stack_min: 10,
    p3_stack_max: 50,

    situacion: "BTN_vs_SB_BB",

    orRanges: {
      OR_TO_CALL_ANY: "",
      OPEN_PUSH: "",
      OR_TO_CALL_SMALL: "",
      OR_TO_FOLD: "",
    },

    ...overrides,
  };
}

describe("db/sql.ts - SQLite persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // reset colas y calls
    fakeDb.__setSelectQueue([[{ id: 1, key: "BTN_SB_BB_FISH_FISH", created_at: "", updated_at: "" }]]);
    fakeDb.__getExecuteCalls().length = 0;
    fakeDb.__getSelectCalls().length = 0;
  });

  it("initDB() crea tablas situations y sub_strategies", async () => {
    await initDB();

    const calls = fakeDb.__getExecuteCalls();
    expect(calls.length).toBeGreaterThanOrEqual(2);

    const sqlAll = calls.map((c) => c.sql).join("\n---\n");
    expect(sqlAll).toContain("CREATE TABLE IF NOT EXISTS situations");
    expect(sqlAll).toContain("CREATE TABLE IF NOT EXISTS sub_strategies");
    expect(sqlAll).toContain("FOREIGN KEY (situation_id)");
    expect(sqlAll).toContain("UNIQUE(situation_id, name)");
  });

  it("upsertSituationKey() hace upsert y devuelve situation_id", async () => {
    fakeDb.__setSelectQueue([[{ id: 42, key: "BTN_SB_BB_FISH_FISH", created_at: "", updated_at: "" }]]);

    const id = await upsertSituationKey("BTN_SB_BB_FISH_FISH");
    expect(id).toBe(42);

    const execCalls = fakeDb.__getExecuteCalls();
    expect(execCalls.length).toBe(1);
    expect(execCalls[0].sql).toContain("INSERT INTO situations");
    expect(execCalls[0].sql).toContain("ON CONFLICT(key) DO UPDATE");
    expect(execCalls[0].params).toEqual(["BTN_SB_BB_FISH_FISH"]);

    const selCalls = fakeDb.__getSelectCalls();
    expect(selCalls.length).toBe(1);
    expect(selCalls[0].sql).toContain("SELECT id");
    expect(selCalls[0].params).toEqual(["BTN_SB_BB_FISH_FISH"]);
  });

  it("ensureBucketsForSituation() inserta (DO NOTHING) los 7 buckets con min/max", async () => {
    await ensureBucketsForSituation(7);

    const calls = fakeDb.__getExecuteCalls();
    expect(calls.length).toBe(DEFAULT_BUCKETS.length);

    // Comprueba 1 bucket concreto
    const b0 = DEFAULT_BUCKETS[0]; // "20_75_BB"
    const call0 = calls[0];
    expect(call0.sql).toContain("INSERT INTO sub_strategies");
    expect(call0.sql).toContain("ON CONFLICT(situation_id, name) DO NOTHING");
    expect(call0.params?.[0]).toBe(7);
    expect(call0.params?.[1]).toBe(b0);

    // params: [situationId, bucketName, stack_min, stack_max]
    // "20_75_BB" -> 20, 75
    if (b0 === "20_75_BB") {
      expect(call0.params?.[2]).toBe(20);
      expect(call0.params?.[3]).toBe(75);
    }
  });

  it("upsertSubStrategy() rechaza payload inválido (no guarda)", async () => {
    const badPayload = { hello: "world" };
    await expect(upsertSubStrategy(9, "18_20_BB", badPayload, 18, 20)).rejects.toThrow(/sub_strategies/i);

    const calls = fakeDb.__getExecuteCalls();
    // ✅ no debe ejecutar INSERT si falla validación
    expect(calls.length).toBe(0);
  });

  it("upsertSubStrategy() hace upsert UPDATE con payload NORMALIZADO + stack_min/max", async () => {
    const payload = makeValidPayload({
      spot: "btn", // prueba normalización a BTN
      hero_pos: "btn",
      p2_tipo: "fish",
      p3_tipo: "reg",
    });

    await upsertSubStrategy(9, "18_20_BB", payload, 18, 20);

    const calls = fakeDb.__getExecuteCalls();
    expect(calls.length).toBe(1);

    const c = calls[0];
    expect(c.sql).toContain("INSERT INTO sub_strategies");
    expect(c.sql).toContain("ON CONFLICT(situation_id, name) DO UPDATE SET");
    expect(c.params?.[0]).toBe(9);
    expect(c.params?.[1]).toBe("18_20_BB");
    expect(c.params?.[2]).toBe(18);
    expect(c.params?.[3]).toBe(20);

    // payload_json: debe contener spot/hero_pos normalizados a BTN
    const payloadJson = String(c.params?.[4] ?? "");
    expect(payloadJson).toContain('"spot":"BTN"');
    expect(payloadJson).toContain('"hero_pos":"BTN"');
    expect(payloadJson).toContain('"p3_tipo":"reg"');
  });

  it("listSubStrategiesBySituationKey() hace JOIN y devuelve rows", async () => {
    const rows = [
      {
        id: 1,
        situation_id: 2,
        name: "20_75_BB",
        stack_min: 20,
        stack_max: 75,
        unit: "BB",
        payload_json: "{}",
        created_at: "",
        updated_at: "",
      },
    ];

    fakeDb.__setSelectQueue([rows]);

    const out = await listSubStrategiesBySituationKey("BTN_SB_BB_FISH_FISH");
    expect(out).toEqual(rows);

    const selCalls = fakeDb.__getSelectCalls();
    expect(selCalls.length).toBe(1);
    expect(selCalls[0].sql).toContain("FROM sub_strategies ss");
    expect(selCalls[0].sql).toContain("JOIN situations s");
    expect(selCalls[0].sql).toContain("WHERE s.key");
    expect(selCalls[0].params).toEqual(["BTN_SB_BB_FISH_FISH"]);
  });

  it("pickBucketName() devuelve exact match si coincide", () => {
    expect(pickBucketName(20, 75)).toBe("20_75_BB");
    expect(pickBucketName(0, 6)).toBe("0_6_BB");
  });

  it("pickBucketName() fallback: elige bucket que contiene stackMin", () => {
    // stackMin=19 debería caer en 18_20_BB
    expect(pickBucketName(19, 999)).toBe("18_20_BB");
    // stackMin=13 -> 11_14_BB
    expect(pickBucketName(13, 999)).toBe("11_14_BB");
  });
});
