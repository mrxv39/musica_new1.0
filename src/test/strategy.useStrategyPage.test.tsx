/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\test\strategy.useStrategyPage.test.tsx
 */
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";

import { useStrategyPage } from "../pages/strategy/useStrategyPage";
import { emptyStore } from "../pages/strategy/state";
import type { StrategyStore } from "../strategy/types";

// ---- Mocks DB ----
vi.mock("../pages/strategy/db", () => {
  return {
    dbInit: vi.fn(),
    dbLoadSubs: vi.fn(),
    dbSaveSub: vi.fn(),
  };
});

import { dbInit, dbLoadSubs, dbSaveSub } from "../pages/strategy/db";

function setClipboardMock(ok: boolean) {
  const writeText = ok ? vi.fn().mockResolvedValue(undefined) : vi.fn().mockRejectedValue(new Error("nope"));

  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
  });

  return writeText;
}

async function flushMicrotasks(times = 10) {
  for (let i = 0; i < times; i++) await Promise.resolve();
}

describe("pages/strategy/useStrategyPage", () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    (dbInit as any).mockResolvedValue(undefined);
    (dbLoadSubs as any).mockResolvedValue(emptyStore() as StrategyStore);
    (dbSaveSub as any).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("on mount calls dbInit + dbLoadSubs and ends without error (LOAD OK)", async () => {
    const { result } = renderHook(() => useStrategyPage({ globalName: "GLOB" }));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(dbInit).toHaveBeenCalledTimes(1);
    expect(dbLoadSubs).toHaveBeenCalledTimes(1);
    expect(dbLoadSubs).toHaveBeenCalledWith("GLOB");
    expect(result.current.error).toBe(null);
  });

  test("if load fails sets DB LOAD ERROR and recovers with empty store", async () => {
    (dbLoadSubs as any).mockRejectedValueOnce(new Error("boom-load"));

    const { result } = renderHook(() => useStrategyPage({ globalName: "GLOB" }));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe("DB LOAD ERROR: boom-load");
    expect(result.current.store).toBeTruthy();
  });

  test("createNew() creates a new item and selects it", async () => {
    const { result } = renderHook(() => useStrategyPage({ globalName: "GLOB" }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.createNew();
    });

    await waitFor(() => {
      expect(result.current.selectedId).toBeTruthy();
      expect(result.current.subs.length).toBe(1);
    });

    expect(result.current.error).toBe(null);
  });

  test("saveSelected() (manual) calls dbSaveSub and sets 'Guardado en sqlite'", async () => {
    const { result } = renderHook(() => useStrategyPage({ globalName: "GLOB" }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.createNew();
    });

    await waitFor(() => expect(result.current.selectedId).toBeTruthy());

    await act(async () => {
      await result.current.saveSelected();
    });

    expect(dbSaveSub).toHaveBeenCalledTimes(1);
    const payload = (dbSaveSub as any).mock.calls[0][0];
    expect(payload.globalName).toBe("GLOB");
    expect(result.current.error).toBe("Guardado en sqlite");
  });

  test("saveSelected() (manual) on failure sets 'DB Save ERROR: <msg>'", async () => {
    (dbSaveSub as any).mockRejectedValueOnce(new Error("boom-save"));

    const { result } = renderHook(() => useStrategyPage({ globalName: "GLOB" }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.createNew();
    });

    await waitFor(() => expect(result.current.selectedId).toBeTruthy());

    await act(async () => {
      await result.current.saveSelected();
    });

    expect(result.current.error).toBe("DB Save ERROR: boom-save");
  });

  test(
    "autosave: changing editorValue triggers saveSelectedInternal('auto') after debounce and sets 'Auto-guardado'",
    async () => {
      // ✅ fake timers ANTES de montar el hook
      vi.useFakeTimers();

      const { result } = renderHook(() => useStrategyPage({ globalName: "GLOB" }));

      // ⚠️ NO waitFor aquí (usa timers). Hacemos flush manual.
      await act(async () => {
        await flushMicrotasks();
      });

      // crear item y seleccionar
      act(() => {
        result.current.createNew();
      });

      // asegurar selección sin waitFor (solo microtasks)
      await act(async () => {
        await flushMicrotasks();
      });

      expect(result.current.selectedId).toBeTruthy();

      // cambio que marca dirty y programa debounce
      act(() => {
        result.current.setEditorValue({ foo: "bar" } as any);
      });

      // disparar debounce + resolver promesas del autosave
      await act(async () => {
        await vi.advanceTimersByTimeAsync(700);
        await flushMicrotasks();
      });

      expect(dbSaveSub).toHaveBeenCalled();
      expect(result.current.error).toBe("Auto-guardado");
    },
    10000
  );

  test("copyPayloadJson() OK sets 'Copiado'", async () => {
    const writeText = setClipboardMock(true);

    const { result } = renderHook(() => useStrategyPage({ globalName: "GLOB" }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.copyPayloadJson();
    });

    expect(writeText).toHaveBeenCalledTimes(1);
    expect(result.current.error).toBe("Copiado");
  });

  test("copyPayloadJson() FAIL sets 'Copy ERROR'", async () => {
    setClipboardMock(false);

    const { result } = renderHook(() => useStrategyPage({ globalName: "GLOB" }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.copyPayloadJson();
    });

    expect(result.current.error).toBe("Copy ERROR");
  });
});
