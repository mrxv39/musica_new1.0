/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\test\dbSaveSub.no_autocreate_situation.contract.test.ts
 *
 * Contrato: dbSaveSub NO debe auto-crear una situation si el payload trae una situacion inexistente.
 * Debe rechazar (throw) y NO llamar a upsertSituationKey.
 *
 * Este test debe FALLAR con el comportamiento actual (porque repo.ts llama upsertSituationKey
 * y eso crea la situation).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ⚠️ IMPORTANTE: vi.mock se evalúa hoisted. No uses variables top-level dentro.
vi.mock("../db/sql", () => {
  return {
    initDB: vi.fn(async () => {}),
    listSituations: vi.fn(async () => []),
    upsertSituationKey: vi.fn(async (_key: string) => 999),
    upsertSubStrategy: vi.fn(async () => {}),

    // exports extra por si repo.ts los importa en el futuro
    renameSituationKey: vi.fn(async () => {}),
    deleteSituationByKey: vi.fn(async () => 1),
    countSubsForSituationKey: vi.fn(async () => 0),
    listAllSubStrategies: vi.fn(async () => []),
    deleteSubStrategyById: vi.fn(async () => true),
  };
});

import * as sql from "../db/sql";
import { dbSaveSub } from "../pages/strategy/db/repo";

type SqlMock = {
  initDB: ReturnType<typeof vi.fn>;
  listSituations: ReturnType<typeof vi.fn>;
  upsertSituationKey: ReturnType<typeof vi.fn>;
  upsertSubStrategy: ReturnType<typeof vi.fn>;
};

describe("dbSaveSub contract - NO autocreate situation", () => {
  const sqlMock = sql as unknown as SqlMock;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("si payload.situacion NO existe en situations, debe rechazar y NO llamar upsertSituationKey", async () => {
    // Usuario SOLO ha creado esta situation:
    (sqlMock.listSituations as any).mockResolvedValueOnce([{ id: 1, key: "BTN_vs_SB_BB_FISH_FISH" }]);

    // Pero el payload intenta guardar bajo otra situacion (bug observado):
    const item: any = {
      id: "ui_tmp",
      payload: {
        situacion: "BTN_vs_SB_BB", // <-- NO existe
        p1_stack_min: 18,
        p1_stack_max: 20,
        p2_tipo: "fish",
        p3_tipo: "fish",
        orRanges: {},
      },
    };

    // Contrato deseado: debe rechazar
    await expect(dbSaveSub(item)).rejects.toThrow(/SITUATION_NOT_FOUND|Missing situation key|invalid/i);

    // Y NO debe intentar crear situation por la puerta de atrás
    expect(sqlMock.upsertSituationKey).not.toHaveBeenCalled();

    // Ni insertar sub
    expect(sqlMock.upsertSubStrategy).not.toHaveBeenCalled();
  });
});