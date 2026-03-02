/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\test\strategy.delete_last_situation.key_must_be_valid.contract.test.tsx
 *
 * CONTRATO: borrar situation NUNCA debe invocar dbDeleteSituationKey con key inválida (undefined o "").
 * Hoy está roto -> test debe FALLAR hasta que se arregle.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

vi.mock("../pages/strategy/db", () => {
  return {
    dbInit: vi.fn(async () => {}),

    dbLoadSubs: vi.fn(async (_globalName: string) => ({
      globals: { GLOBAL: { name: "GLOBAL", subs: [] } },
    })),

    dbListSituations: vi.fn(async () => [{ id: 1, key: "ONLY_ONE" }]),

    dbDeleteSituationKey: vi.fn(async (key: any, _opts?: any) => {
      const k = String(key ?? "").trim();
      if (!k) throw new Error("key vacío");
      return { deleted: true, subCount: 0 };
    }),

    dbUpsertSituation: vi.fn(async (_key: string) => 1),
    dbRenameSituationKey: vi.fn(async (_a: string, _b: string) => {}),
    dbCountSubsForSituationKey: vi.fn(async (_key: string) => 0),

    dbSaveSub: vi.fn(async () => ({ situationKey: "ONLY_ONE", bucket: "0_0_BB" })),
  };
});

import * as db from "../pages/strategy/db";
import { useStrategyPage } from "../pages/strategy/useStrategyPage";

function flushMicrotasks() {
  return new Promise<void>((r) => setTimeout(r, 0));
}

describe("CONTRACT - delete situation must use valid key", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("debe llamar dbDeleteSituationKey con un key NO vacío", async () => {
    (db as any).dbListSituations.mockResolvedValueOnce([{ id: 1, key: "BTN_vs_SB_BB_FISH_FISH" }]);

    const { result } = renderHook(() => useStrategyPage());

    await act(async () => {
      await flushMicrotasks();
      await flushMicrotasks();
    });

    await act(async () => {
      const api: any = result.current as any;
      if (typeof api.deleteSituationForce === "function") return api.deleteSituationForce();
      if (typeof api.deleteSituation === "function") return api.deleteSituation();
      if (typeof api.onDeleteSituation === "function") return api.onDeleteSituation();
      throw new Error("Hook API no expone deleteSituation/deleteSituationForce/onDeleteSituation");
    });

    const calls = ((db as any).dbDeleteSituationKey as any).mock.calls.map((c: any[]) => c[0]);

    // CONTRATO: todas las llamadas deben tener key válido
    const invalidCalls = calls.filter((k: any) => k == null || String(k).trim() === "");
    expect(invalidCalls).toEqual([]);
  });
});