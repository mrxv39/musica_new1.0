import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const invokeMock = vi.fn();
const setWorkersRunningCommandMock = vi.fn();
const runWorkersTickCommandMock = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

vi.mock("../pages/hands/handsPagePaths", () => ({
  BATCH_FOLDER_PATH: "C:\\batch\\folder",
  CHAMPION_XML_DIR: "C:\\xml",
  CHAMPION_HERO: "hero",
  summarize: (s: string) => s,
}));

vi.mock("../pages/hands/handsPageUtils", () => ({
  buildWorkersOutDir: () => "C:\\tmp\\workers_out",
  getErrorMessage: (e: unknown) => String(e),
}));

vi.mock("../pages/hands/workersClient", () => ({
  setWorkersRunningCommand: (...args: unknown[]) => setWorkersRunningCommandMock(...args),
  runWorkersTickCommand: (...args: unknown[]) => runWorkersTickCommandMock(...args),
}));

import { useHandsPageWorkerActions } from "../pages/hands/useHandsPageWorkerActions";

describe("useHandsPageWorkerActions edge cases", () => {
  const setWorkersRunning = vi.fn();
  const setBusy = vi.fn();
  const setActionStatus = vi.fn();
  const setLastLog = vi.fn();
  const loadObsOnce = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("onRunBatch deja busy=false y escribe lastLog en éxito", async () => {
    invokeMock.mockResolvedValue("batch ok");

    const { result } = renderHook(() =>
      useHandsPageWorkerActions({
        safeDbPath: "C:\\db\\poker_boss.db",
        workersRunning: false,
        setWorkersRunning,
        setBusy,
        setActionStatus,
        setLastLog,
        loadObsOnce,
      })
    );

    await act(async () => {
      await result.current.onRunBatch();
    });

    expect(setBusy).toHaveBeenCalledWith(true);
    expect(setBusy).toHaveBeenLastCalledWith(false);
    expect(setLastLog).toHaveBeenCalledWith("batch ok");
  });

  it("onRunBatch deja busy=false y guarda ERROR si falla", async () => {
    invokeMock.mockRejectedValue(new Error("batch boom"));

    const { result } = renderHook(() =>
      useHandsPageWorkerActions({
        safeDbPath: "C:\\db\\poker_boss.db",
        workersRunning: false,
        setWorkersRunning,
        setBusy,
        setActionStatus,
        setLastLog,
        loadObsOnce,
      })
    );

    await act(async () => {
      await result.current.onRunBatch();
    });

    expect(setBusy).toHaveBeenLastCalledWith(false);
    expect(setLastLog).toHaveBeenCalledWith(expect.stringContaining("ERROR:"));
    expect(loadObsOnce).not.toHaveBeenCalled();
  });

  it("onToggleWorkers deja busy=false y guarda lastLog en éxito", async () => {
    setWorkersRunningCommandMock.mockResolvedValue("workers started");

    const { result } = renderHook(() =>
      useHandsPageWorkerActions({
        safeDbPath: "C:\\db\\poker_boss.db",
        workersRunning: false,
        setWorkersRunning,
        setBusy,
        setActionStatus,
        setLastLog,
        loadObsOnce,
      })
    );

    await act(async () => {
      await result.current.onToggleWorkers();
    });

    expect(setBusy).toHaveBeenCalledWith(true);
    expect(setBusy).toHaveBeenLastCalledWith(false);
    expect(setLastLog).toHaveBeenCalledWith("workers started");
  });

  it("onToggleWorkers deja busy=false y no cambia running si falla", async () => {
    setWorkersRunningCommandMock.mockRejectedValue(new Error("toggle boom"));

    const { result } = renderHook(() =>
      useHandsPageWorkerActions({
        safeDbPath: "C:\\db\\poker_boss.db",
        workersRunning: false,
        setWorkersRunning,
        setBusy,
        setActionStatus,
        setLastLog,
        loadObsOnce,
      })
    );

    await act(async () => {
      await result.current.onToggleWorkers();
    });

    expect(setBusy).toHaveBeenLastCalledWith(false);
    expect(setLastLog).toHaveBeenCalledWith(expect.stringContaining("ERROR:"));
    expect(setWorkersRunning).not.toHaveBeenCalled();
  });

  it("onWorkersTick deja busy=false y guarda lastLog en éxito", async () => {
    runWorkersTickCommandMock.mockResolvedValue("tick ok");

    const { result } = renderHook(() =>
      useHandsPageWorkerActions({
        safeDbPath: "C:\\db\\poker_boss.db",
        workersRunning: false,
        setWorkersRunning,
        setBusy,
        setActionStatus,
        setLastLog,
        loadObsOnce,
      })
    );

    await act(async () => {
      await result.current.onWorkersTick();
    });

    expect(setBusy).toHaveBeenCalledWith(true);
    expect(setBusy).toHaveBeenLastCalledWith(false);
    expect(setLastLog).toHaveBeenCalledWith("tick ok");
  });

  it("onWorkersTick deja busy=false y guarda ERROR si falla", async () => {
    runWorkersTickCommandMock.mockRejectedValue(new Error("tick boom"));

    const { result } = renderHook(() =>
      useHandsPageWorkerActions({
        safeDbPath: "C:\\db\\poker_boss.db",
        workersRunning: false,
        setWorkersRunning,
        setBusy,
        setActionStatus,
        setLastLog,
        loadObsOnce,
      })
    );

    await act(async () => {
      await result.current.onWorkersTick();
    });

    expect(setBusy).toHaveBeenLastCalledWith(false);
    expect(setLastLog).toHaveBeenCalledWith(expect.stringContaining("ERROR:"));
  });
});

