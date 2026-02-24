/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\test\strategy.reload.fromdb.test.ts
 *
 * Test unitario: reloadFromDb
 * - éxito: llama dbInit+dbLoadSubs, setea subs, y selecciona first si no hay selectedId
 * - fallo: setError incluye "DB LOAD ERROR" y deja store vacío
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../pages/strategy/db", () => {
  return {
    dbInit: vi.fn(async () => {}),
    dbLoadSubs: vi.fn(async (globalName: string) => {
      return {
        globals: {
          [globalName]: {
            subs: [
              { id: "db_1", name: "A", payload: { situacion: "X", orRanges: {}, orRangesPlan: {} } },
            ],
          },
        },
      };
    }),
  };
});

describe("reloadFromDb()", () => {
  beforeEach(() => vi.clearAllMocks());

  it("loads, sets subsView, and hydrates first selection", async () => {
    const { reloadFromDb } = await import("../pages/strategy/useStrategyPage/reload");

    const setIsLoading = vi.fn();
    const setError = vi.fn();
    const setStore = vi.fn();
    const setSubsView = vi.fn();
    const setSelectedId = vi.fn();
    const setEditorValue = vi.fn();
    const setOrRangesRows = vi.fn();
    const dirtyRef = { current: true };

    await reloadFromDb({
      globalName: "G",
      selectedId: null,
      setIsLoading,
      setError,
      setStore,
      setSubsView,
      setSelectedId,
      setEditorValue,
      setOrRangesRows,
      dirtyRef,
    });

    expect(setStore).toHaveBeenCalled();
    expect(setSubsView).toHaveBeenCalled();
    expect(setSelectedId).toHaveBeenCalledWith("db_1");
    expect(dirtyRef.current).toBe(false);
  });

  it("on failure sets DB LOAD ERROR and falls back to empty", async () => {
    const modDb = await import("../pages/strategy/db");
    (modDb.dbLoadSubs as any).mockRejectedValueOnce(new Error("boom"));

    const { reloadFromDb } = await import("../pages/strategy/useStrategyPage/reload");

    const setIsLoading = vi.fn();
    const setError = vi.fn();
    const setStore = vi.fn();
    const setSubsView = vi.fn();
    const setSelectedId = vi.fn();
    const setEditorValue = vi.fn();
    const setOrRangesRows = vi.fn();
    const dirtyRef = { current: true };

    await reloadFromDb({
      globalName: "G",
      selectedId: null,
      setIsLoading,
      setError,
      setStore,
      setSubsView,
      setSelectedId,
      setEditorValue,
      setOrRangesRows,
      dirtyRef,
    });

    const msg = String(setError.mock.calls.at(-1)?.[0] ?? "");
    expect(msg).toMatch(/DB LOAD ERROR:/);
    expect(setStore).toHaveBeenCalled();
    expect(dirtyRef.current).toBe(false);
  });
});
