/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\test\strategy.delete_last_situation.key_empty.repro.test.tsx
 *
 * REGRESIÓN (antes era repro):
 * - Al borrar la última situation, NO se debe llamar dbDeleteSituationKey con key inválida (undefined/"").
 * - No debe aparecer "key vacío".
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

vi.mock("../pages/strategy/db", () => {
  return {
    dbInit: vi.fn(async () => {}),
    dbLoadSubs: vi.fn(async (_globalName: string) => ({
      globals: { GLOBAL: { name: "GLOBAL", subs: [] } },
    })),
    dbListSituations: vi.fn(async () => [{ id: 1, key: "BTN_vs_SB_BB_FISH_FISH" }]),
    dbDeleteSituationKey: vi.fn(async (key: any, _opts?: any) => {
      const k = String(key ?? "").trim();
      if (!k) throw new Error("key vacío");
      return { deleted: true, subCount: 0 };
    }),
    dbUpsertSituation: vi.fn(async (_key: string) => 1),
    dbRenameSituationKey: vi.fn(async (_a: string, _b: string) => {}),
    dbCountSubsForSituationKey: vi.fn(async (_key: string) => 0),
    dbSaveSub: vi.fn(async () => ({ situationKey: "BTN_vs_SB_BB_FISH_FISH", bucket: "0_0_BB" })),
  };
});

import * as db from "../pages/strategy/db";
import { useStrategyPage } from "../pages/strategy/useStrategyPage";

function flushMicrotasks() {
  return new Promise<void>((r) => setTimeout(r, 0));
}

describe("REGRESSION - delete last situation must not use empty key", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("no debe llamar dbDeleteSituationKey con key inválida (undefined/empty)", async () => {
    const { result } = renderHook(() => useStrategyPage());

    await act(async () => {
      await flushMicrotasks();
      await flushMicrotasks();
    });

    await act(async () => {
      const api: any = result.current as any;
      if (typeof api.deleteSituationForce === "function") return api.deleteSituationForce(undefined as any);
      if (typeof api.deleteSituation === "function") return api.deleteSituation(undefined as any);
      throw new Error("Hook API no expone deleteSituation/deleteSituationForce");
    });

    const calls = ((db as any).dbDeleteSituationKey as any).mock.calls.map((c: any[]) => c[0]);
    const invalidCalls = calls.filter((k: any) => k == null || String(k).trim() === "");
    expect(invalidCalls).toEqual([]);

    const api: any = result.current as any;
    const msg = String(api?.error ?? api?.status ?? api?.msg ?? "");
    expect(msg.toLowerCase()).not.toContain("key vacío");
  });
});