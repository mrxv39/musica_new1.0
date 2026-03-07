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

describe("useHandsPageWorkerActions", () => {
  const setWorkersRunning = vi.fn();
  const setBusy = vi.fn();
  const setActionStatus = vi.fn();
  const setLastLog = vi.fn();
  const loadObsOnce = vi.fn();

  beforeEach(() => {
    invokeMock.mockReset();
    setWorkersRunningCommandMock.mockReset();
    runWorkersTickCommandMock.mockReset();
    setWorkersRunning.mockReset();
    setBusy.mockReset();
    setActionStatus.mockReset();
    setLastLog.mockReset();
    loadObsOnce.mockReset();
  });

  it("onRunBatch calls run_worker_batch and reloads obs", async () => {
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

    expect(invokeMock).toHaveBeenCalledWith("run_worker_batch", {
      folderPath: "C:\\batch\\folder",
      limit: 50,
      dbPath: "C:\\db\\poker_boss.db",
    });
    expect(loadObsOnce).toHaveBeenCalledTimes(1);
  });

  it("onRunOneForImage calls run_worker_one and returns message", async () => {
    invokeMock.mockResolvedValue("one ok");

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

    let out = "";
    await act(async () => {
      out = await result.current.onRunOneForImage("C:\\img\\a.bmp");
    });

    expect(out).toBe("one ok");
    expect(invokeMock).toHaveBeenCalledWith("run_worker_one", {
      imagePath: "C:\\img\\a.bmp",
      dbPath: "C:\\db\\poker_boss.db",
    });
    expect(loadObsOnce).toHaveBeenCalledTimes(1);
  });

  it("onToggleWorkers starts workers and updates local running state", async () => {
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

    expect(setWorkersRunningCommandMock).toHaveBeenCalledWith({
      running: true,
      dbPath: "C:\\db\\poker_boss.db",
      outDir: "C:\\tmp\\workers_out",
      intervalMs: 3000,
    });
    expect(setWorkersRunning).toHaveBeenCalledWith(true);
  });

  it("onToggleWorkers stops workers when already running", async () => {
    setWorkersRunningCommandMock.mockResolvedValue("workers stopped");

    const { result } = renderHook(() =>
      useHandsPageWorkerActions({
        safeDbPath: "C:\\db\\poker_boss.db",
        workersRunning: true,
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

    expect(setWorkersRunningCommandMock).toHaveBeenCalledWith({
      running: false,
      dbPath: "C:\\db\\poker_boss.db",
      outDir: "C:\\tmp\\workers_out",
      intervalMs: 3000,
    });
    expect(setWorkersRunning).toHaveBeenCalledWith(false);
  });

  it("onWorkersTick calls runWorkersTickCommand", async () => {
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

    expect(runWorkersTickCommandMock).toHaveBeenCalledWith({
      dbPath: "C:\\db\\poker_boss.db",
      outDir: "C:\\tmp\\workers_out",
      intervalMs: 3000,
      maxTicks: 1,
    });
  });

  it("onRunOneForImage returns error string on failure", async () => {
    invokeMock.mockRejectedValue(new Error("boom"));

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

    let out = "";
    await act(async () => {
      out = await result.current.onRunOneForImage("C:\\img\\a.bmp");
    });

    expect(out).toContain("ERROR:");
    expect(loadObsOnce).not.toHaveBeenCalled();
  });
});
