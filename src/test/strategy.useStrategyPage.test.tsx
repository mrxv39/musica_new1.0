/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\test\strategy.useStrategyPage.test.tsx
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

import { useStrategyPage } from "../pages/strategy/useStrategyPage";

// ---- mocks DB ----
vi.mock("../pages/strategy/db", () => {
  return {
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
                spot: "BTN",
                hero_pos: "BTN",
                p1_bet_min: 0,
                p1_bet_max: 75,
                p1_stack_min: 0,
                p1_stack_max: 75,
                p1_se_min: 0,
                p1_se_max: 75,
                p2_pos: "SB",
                p2_tipo: "fish",
                p2_bet_min: 0,
                p2_bet_max: 75,
                p2_stack_min: 0,
                p2_stack_max: 75,
                p3_pos: "BB",
                p3_tipo: "fish",
                p3_bet_min: 0,
                p3_bet_max: 75,
                p3_stack_min: 0,
                p3_stack_max: 75,
                situacion: "BTN_vs_SB_BB",
                orRanges: {
                  OR_TO_CALL_ANY: "",
                  OPEN_PUSH: "",
                  OR_TO_CALL_SMALL: "",
                  OR_TO_FOLD: "",
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
  };
});

// ---- mocks state helpers (usa implementación real) ----
vi.mock("../pages/strategy/state", async () => {
  const actual: any = await vi.importActual("../pages/strategy/state");
  return actual;
});

afterEach(() => {
  // 🔒 pase lo que pase, que NO se queden timers falsos activos
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("pages/strategy/useStrategyPage", () => {
  it("on mount calls dbInit + dbLoadSubs and ends without error (LOAD OK)", async () => {
    const { result } = renderHook(() => useStrategyPage({ globalName: "default" }));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe(null);
    expect(result.current.subs.length).toBeGreaterThan(0);
  });

  it("if load fails sets DB LOAD ERROR and recovers with empty store", async () => {
    const { dbLoadSubs } = await import("../pages/strategy/db");
    (dbLoadSubs as any).mockImplementationOnce(async () => {
      throw new Error("boom");
    });

    const { result } = renderHook(() => useStrategyPage({ globalName: "default" }));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error || "").toMatch(/DB LOAD ERROR/i);
  });

  it("createNew() creates a new item and selects it", async () => {
    const { result } = renderHook(() => useStrategyPage({ globalName: "default" }));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.createNew();
    });

    expect(result.current.selectedId).toBeTruthy();
  });

  it("saveSelected() (manual) calls dbSaveSub and sets 'Guardado en sqlite'", async () => {
    const { dbSaveSub } = await import("../pages/strategy/db");

    const { result } = renderHook(() => useStrategyPage({ globalName: "default" }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.saveSelected();
    });

    expect(dbSaveSub).toHaveBeenCalled();
    expect(result.current.error).toBe("Guardado en sqlite");
  });

  it("saveSelected() (manual) on failure sets 'DB Save ERROR: <msg>'", async () => {
    const { dbSaveSub } = await import("../pages/strategy/db");
    (dbSaveSub as any).mockImplementationOnce(async () => {
      throw new Error("nope");
    });

    const { result } = renderHook(() => useStrategyPage({ globalName: "default" }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.saveSelected();
    });

    expect(result.current.error || "").toMatch(/DB Save ERROR/i);
  });

  it(
    "autosave: changing editorValue triggers dbSaveSub after debounce (no status spam)",
    async () => {
      const { dbSaveSub } = await import("../pages/strategy/db");

      // 1) Monta con timers reales y espera a que cargue
      const { result } = renderHook(() => useStrategyPage({ globalName: "default" }));
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBe(null);

      // 2) Activa fake timers SOLO para el debounce del autosave
      vi.useFakeTimers();

      act(() => {
        result.current.setEditorValue({
          ...result.current.editorValue,
          p1_bet_min: (result.current.editorValue.p1_bet_min ?? 0) + 1,
        } as any);
      });

      // dispara el setTimeout(650)
      act(() => {
        vi.advanceTimersByTime(700);
      });

      // flush de timers/promesas pendientes
      await act(async () => {
        await vi.runOnlyPendingTimersAsync();
      });

      expect(dbSaveSub).toHaveBeenCalled();

      // ✅ autosave NO toca error (evita parpadeo)
      expect(result.current.error).toBe(null);
    },
    10000
  );

  it("copyPayloadJson() OK sets 'Copiado'", async () => {
    const { result } = renderHook(() => useStrategyPage({ globalName: "default" }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });

    await act(async () => {
      await result.current.copyPayloadJson();
    });

    expect(writeText).toHaveBeenCalled();
    expect(result.current.error).toBe("Copiado");
  });

  it("copyPayloadJson() FAIL sets 'Copy ERROR'", async () => {
    const { result } = renderHook(() => useStrategyPage({ globalName: "default" }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const writeText = vi.fn(async () => {
      throw new Error("no");
    });
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });

    await act(async () => {
      await result.current.copyPayloadJson();
    });

    expect(result.current.error).toBe("Copy ERROR");
  });
});
