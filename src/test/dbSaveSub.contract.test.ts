/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\test\dbSaveSub.contract.test.ts
 *
 * Contract test:
 * UI Save button -> pages/strategy/db.ts (dbSaveSub) -> db/sql.ts (upsertSubStrategy)
 *
 * Objetivo:
 * - Evitar que Guardar pueda llegar a DB sin campos core (spot/hero_pos/pos/tipos/rangos).
 * - Este test debe FALLAR si el payload que sale del UI boundary no incluye esos campos.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

// Importamos defaultPayload (lo que usa el hook/editor por defecto)
import { defaultPayload } from "../pages/strategy/state";

// Importamos la función real que usa el botón Guardar
import { dbSaveSub } from "../pages/strategy/db";

// --- Mock del boundary DB real (src/db/sql.ts) ---
// Nota: dbSaveSub importa desde "../../db/sql"
vi.mock("../db/sql", () => {
  return {
    initDB: vi.fn(async () => {}),
    listAllSubStrategies: vi.fn(async () => []),

    // ✅ NUEVO: dbSaveSub ahora consulta listSituations para NO autocrear
    listSituations: vi.fn(async () => [{ id: 1, key: "BTN_vs_SB_BB" }]),

    // bucket: no nos importa aquí, solo que no rompa (puede no usarse)
    pickBucketName: vi.fn(() => "18_20_BB"),

    // Ya NO debería llamarse desde dbSaveSub (por contrato nuevo), pero lo dejamos por compat
    upsertSituationKey: vi.fn(async (_key: string) => 123),
    ensureBucketsForSituation: vi.fn(async (_sid: number) => {}),

    // 👇 ESTE ES EL CONTRATO CRÍTICO:
    // Si dbSaveSub llega aquí sin campos core, el test debe fallar.
    upsertSubStrategy: vi.fn(async (_situationId: number, _name: string, payloadForJson: any) => {
      const p = payloadForJson ?? {};

      const mustStr = (k: string) => {
        if (typeof p[k] !== "string" || !p[k].trim()) {
          throw new Error(`CONTRACT_FAIL: missing "${k}"`);
        }
        return p[k].trim();
      };

      // Campos core que DB HARD VALIDATION exige
      mustStr("spot");
      mustStr("hero_pos");
      mustStr("p2_pos");
      mustStr("p3_pos");
      mustStr("p2_tipo");
      mustStr("p3_tipo");
      mustStr("situacion");

      // y rangos numéricos mínimos (la validación dura exige finitos)
      const mustNum = (k: string) => {
        const n = typeof p[k] === "number" ? p[k] : Number(p[k]);
        if (!Number.isFinite(n)) throw new Error(`CONTRACT_FAIL: "${k}" not finite`);
        return n;
      };

      mustNum("p1_stack_min");
      mustNum("p1_stack_max");
      mustNum("p1_bet_min");
      mustNum("p1_bet_max");
      mustNum("p1_se_min");
      mustNum("p1_se_max");

      mustNum("p2_stack_min");
      mustNum("p2_stack_max");
      mustNum("p2_bet_min");
      mustNum("p2_bet_max");

      mustNum("p3_stack_min");
      mustNum("p3_stack_max");
      mustNum("p3_bet_min");
      mustNum("p3_bet_max");
    }),

    deleteSubStrategyById: vi.fn(async (_id: number) => true),
  };
});

describe("dbSaveSub contract (UI -> DB boundary)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("defaultPayload() NO puede permitir un Guardar que llegue a DB sin campos core", async () => {
    const p = defaultPayload();

    const item: any = {
      id: "ui_test_1",
      name: "Auto sub X",
      payload: p,
      or_ranges: (p as any).orRanges,
      globalName: "default",
    };

    await expect(dbSaveSub(item)).resolves.toEqual(
      expect.objectContaining({
        bucket: expect.any(String),
        situationKey: expect.any(String),
      })
    );
  });

  it('si payload trae "situation" (legacy) pero no "situacion", dbSaveSub NO debe acabar en situationKey="unknown"', async () => {
    const p: any = {
      ...defaultPayload(),
      // legacy
      situation: "BTN_vs_SB_BB",
      // y metemos unos mínimos para que el contrato pase si el sistema lo mapeara bien
      spot: "BTN",
      hero_pos: "BTN",
      p2_pos: "SB",
      p3_pos: "BB",
      p2_tipo: "fish",
      p3_tipo: "fish",
      p1_stack_min: 18,
      p1_stack_max: 20,
      p1_bet_min: 0,
      p1_bet_max: 0,
      p1_se_min: 18,
      p1_se_max: 20,
      p2_stack_min: 18,
      p2_stack_max: 20,
      p2_bet_min: 0,
      p2_bet_max: 0,
      p3_stack_min: 18,
      p3_stack_max: 20,
      p3_bet_min: 0,
      p3_bet_max: 0,
      // 👇 intencionalmente NO ponemos "situacion" para que se vea si hay mapping
    };

    const item: any = {
      id: "ui_test_legacy",
      name: "Auto sub legacy",
      payload: p,
      or_ranges: (p as any).orRanges,
      globalName: "default",
    };

    const out = await dbSaveSub(item);
    expect(out.situationKey).not.toBe("unknown");
  });
});