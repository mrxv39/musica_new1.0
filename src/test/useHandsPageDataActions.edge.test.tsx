import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const invokeMock = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

vi.mock("../pages/hands/handsPagePaths", () => ({
  CHAMPION_HERO: "xavieeee2",
  CHAMPION_XML_DIR: "C:\\xml\\dir",
  XML_ARCHIVE_DIR: "C:\\xml\\archive",
  summarize: (s: string) => s,
}));

vi.mock("../pages/hands/handsPageUtils", () => ({
  getErrorMessage: (e: unknown) => String(e),
}));

import { useHandsPageDataActions } from "../pages/hands/useHandsPageDataActions";

describe("useHandsPageDataActions edge cases", () => {
  const setBusy = vi.fn();
  const setActionStatus = vi.fn();
  const setLastLog = vi.fn();
  const loadObsOnce = vi.fn();
  const loadRealOnce = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("onReset en OBS deja busy=false y guarda lastLog en éxito", async () => {
    invokeMock.mockResolvedValue("reset ok");

    const { result } = renderHook(() =>
      useHandsPageDataActions({
        mode: "OBS",
        safeDbPath: "C:\\db\\poker_boss.db",
        setBusy,
        setActionStatus,
        setLastLog,
        loadObsOnce,
        loadRealOnce,
      })
    );

    await act(async () => {
      await result.current.onReset();
    });

    expect(setBusy).toHaveBeenCalledWith(true);
    expect(setBusy).toHaveBeenLastCalledWith(false);
    expect(setLastLog).toHaveBeenCalledWith("reset ok");
  });

  it("onReset en REAL deja busy=false y guarda lastLog en éxito", async () => {
    invokeMock.mockResolvedValue("reset real ok");

    const { result } = renderHook(() =>
      useHandsPageDataActions({
        mode: "REAL",
        safeDbPath: "C:\\db\\poker_boss.db",
        setBusy,
        setActionStatus,
        setLastLog,
        loadObsOnce,
        loadRealOnce,
      })
    );

    await act(async () => {
      await result.current.onReset();
    });

    expect(setBusy).toHaveBeenLastCalledWith(false);
    expect(setLastLog).toHaveBeenCalledWith("reset real ok");
  });

  it("onReset en OBS deja busy=false y guarda ERROR si falla", async () => {
    invokeMock.mockRejectedValue(new Error("reset boom"));

    const { result } = renderHook(() =>
      useHandsPageDataActions({
        mode: "OBS",
        safeDbPath: "C:\\db\\poker_boss.db",
        setBusy,
        setActionStatus,
        setLastLog,
        loadObsOnce,
        loadRealOnce,
      })
    );

    await act(async () => {
      await result.current.onReset();
    });

    expect(setBusy).toHaveBeenLastCalledWith(false);
    expect(setLastLog).toHaveBeenCalledWith(expect.stringContaining("ERROR:"));
    expect(loadObsOnce).not.toHaveBeenCalled();
  });

  it("onImportXml deja busy=false y guarda lastLog en éxito", async () => {
    invokeMock.mockResolvedValue("import ok");

    const { result } = renderHook(() =>
      useHandsPageDataActions({
        mode: "REAL",
        safeDbPath: "C:\\db\\poker_boss.db",
        setBusy,
        setActionStatus,
        setLastLog,
        loadObsOnce,
        loadRealOnce,
      })
    );

    await act(async () => {
      await result.current.onImportXml();
    });

    expect(setBusy).toHaveBeenCalledWith(true);
    expect(setBusy).toHaveBeenLastCalledWith(false);
    expect(setLastLog).toHaveBeenCalledWith("import ok");
  });
});
