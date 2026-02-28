/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\test\strategy.useStrategyPage.situations.test.tsx
 *
 * Objetivo: subir cobertura del folder pages/strategy cubriendo CRUD de situations
 * a través del hook useStrategyPage (paths create/rename/delete + force + reload).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

import { useStrategyPage } from "../pages/strategy/useStrategyPage";

// ---- MOCK DATA ----
let mockSituations: Array<{ id: number; key: string }> = [
  { id: 1, key: "BTN_vs_SB_BB" },
  { id: 2, key: "SB_vs_BB" },
];

type DeleteOpts = { force?: boolean } | undefined;

vi.mock("../pages/strategy/db", () => {
  return {
    // --- usados por el hook (mínimos para que monte sin reventar) ---
    dbInit: vi.fn(async () => {}),
    dbLoadSubs: vi.fn(async () => ({
      globals: {
        default: {
          name: "default",
          subs: [
            {
              id: "db_1",
              name: "sub1",
              payload: {
                situacion: "BTN_vs_SB_BB",
                orRanges: {
                  OR_TO_CALL_ANY: "",
                  OPEN_PUSH: "",
                  OR_TO_CALL_SMALL: "",
                  OR_TO_FOLD: "",
                },
                orRangesPlan: {
                  OR_TO_CALL_ANY: { move: "", bet_min: 0, bet_max: 0 },
                  OPEN_PUSH: { move: "", bet_min: 0, bet_max: 0 },
                  OR_TO_CALL_SMALL: { move: "", bet_min: 0, bet_max: 0 },
                  OR_TO_FOLD: { move: "", bet_min: 0, bet_max: 0 },
                },
              },
              or_ranges: {
                OR_TO_CALL_ANY: "",
                OPEN_PUSH: "",
                OR_TO_CALL_SMALL: "",
                OR_TO_FOLD: "",
              },
            },
          ],
        },
      },
    })),
    dbSaveSub: vi.fn(async () => ({ ok: true })),
    dbDeleteSub: vi.fn(async () => {}),

    // --- situations CRUD (según tu log real) ---
    dbListSituations: vi.fn(async () => mockSituations.slice()),

    dbUpsertSituation: vi.fn(async (key: string) => {
      const k = String(key || "").trim();
      if (!k) throw new Error("empty key");
      if (!mockSituations.some((s) => s.key === k)) {
        const nextId = Math.max(...mockSituations.map((s) => s.id)) + 1;
        mockSituations = [...mockSituations, { id: nextId, key: k }];
      }
      return true;
    }),

    dbRenameSituationKey: vi.fn(async (fromKey: string, toKey: string) => {
      const from = String(fromKey || "").trim();
      const to = String(toKey || "").trim();
      if (!from || !to) throw new Error("bad rename");
      mockSituations = mockSituations.map((s) => (s.key === from ? { ...s, key: to } : s));
      return true;
    }),

    dbCountSubsForSituationKey: vi.fn(async (key: string) => {
      // BTN_vs_SB_BB tiene 1 sub => activa aviso
      return String(key) === "BTN_vs_SB_BB" ? 1 : 0;
    }),

    // 👇 IMPORTANTE: en tu repo se llama con (key, {force:boolean})
    dbDeleteSituationKey: vi.fn(async (key: string, opts?: DeleteOpts) => {
      const k = String(key || "").trim();
      const force = Boolean(opts?.force);

      if (!k) throw new Error("empty key");

      // Si tiene subs y NO force: simula fallo/avisador
      if (k === "BTN_vs_SB_BB" && !force) {
        throw new Error("HAS_SUBS");
      }

      // Si force: borra siempre
      mockSituations = mockSituations.filter((s) => s.key !== k);
      return true;
    }),
  };
});

afterEach(() => {
  vi.clearAllMocks();
  mockSituations = [
    { id: 1, key: "BTN_vs_SB_BB" },
    { id: 2, key: "SB_vs_BB" },
  ];
});

describe("pages/strategy/useStrategyPage (situations CRUD)", () => {
  it("on mount loads situations into hook state", async () => {
    const { result } = renderHook(() => useStrategyPage({ globalName: "default" }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const situations = (result.current as any).situations ?? [];
    expect(Array.isArray(situations)).toBe(true);
    expect(situations.length).toBeGreaterThanOrEqual(2);
  });

  it("createSituation() calls dbUpsertSituation and reloads situations", async () => {
    const { dbUpsertSituation, dbListSituations } = await import("../pages/strategy/db");

    const { result } = renderHook(() => useStrategyPage({ globalName: "default" }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await (result.current as any).createSituation("BB_vs_BTN");
    });

    expect(dbUpsertSituation).toHaveBeenCalled();
    expect(dbListSituations).toHaveBeenCalled();

    const situations = (result.current as any).situations ?? [];
    expect(situations.some((s: any) => String(s.key ?? s) === "BB_vs_BTN")).toBe(true);
  });

  it("renameSituation() calls dbRenameSituationKey and reloads situations", async () => {
    const { dbRenameSituationKey } = await import("../pages/strategy/db");

    const { result } = renderHook(() => useStrategyPage({ globalName: "default" }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await (result.current as any).renameSituation("SB_vs_BB", "SB_vs_BB_v2");
    });

    expect(dbRenameSituationKey).toHaveBeenCalledWith("SB_vs_BB", "SB_vs_BB_v2");

    const situations = (result.current as any).situations ?? [];
    expect(situations.some((s: any) => String(s.key ?? s) === "SB_vs_BB_v2")).toBe(true);
  });

  it("deleteSituation() when HAS_SUBS calls dbDeleteSituationKey with force:false and leaves situation + sets error/warn", async () => {
    const { dbDeleteSituationKey } = await import("../pages/strategy/db");

    const { result } = renderHook(() => useStrategyPage({ globalName: "default" }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await (result.current as any).deleteSituation("BTN_vs_SB_BB");
    });

    expect(dbDeleteSituationKey).toHaveBeenCalledWith("BTN_vs_SB_BB", { force: false });

    // no se borra (porque tenía subs y no force)
    const situations = (result.current as any).situations ?? [];
    expect(situations.some((s: any) => String(s.key ?? s) === "BTN_vs_SB_BB")).toBe(true);

    // y debería haber algún mensaje (error o warning)
    const msg = String((result.current as any).error ?? "");
    expect(msg.length).toBeGreaterThan(0);
  });

  it("deleteSituationForce() calls dbDeleteSituationKey with force:true and deletes + reloads", async () => {
    const { dbDeleteSituationKey } = await import("../pages/strategy/db");

    const { result } = renderHook(() => useStrategyPage({ globalName: "default" }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await (result.current as any).deleteSituationForce("BTN_vs_SB_BB");
    });

    expect(dbDeleteSituationKey).toHaveBeenCalledWith("BTN_vs_SB_BB", { force: true });

    const situations = (result.current as any).situations ?? [];
    expect(situations.some((s: any) => String(s.key ?? s) === "BTN_vs_SB_BB")).toBe(false);
  });
});