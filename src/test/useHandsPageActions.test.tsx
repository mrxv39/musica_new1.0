import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const useHandsPageDataActionsMock = vi.fn();
const useHandsPageWorkerActionsMock = vi.fn();

vi.mock("../pages/hands/useHandsPageDataActions", () => ({
  useHandsPageDataActions: (...args: unknown[]) => useHandsPageDataActionsMock(...args),
}));

vi.mock("../pages/hands/useHandsPageWorkerActions", () => ({
  useHandsPageWorkerActions: (...args: unknown[]) => useHandsPageWorkerActionsMock(...args),
}));

import { useHandsPageActions } from "../pages/hands/useHandsPageActions";

describe("useHandsPageActions", () => {
  const setWorkersRunning = vi.fn();
  const setBusy = vi.fn();
  const setActionStatus = vi.fn();
  const setLastLog = vi.fn();
  const loadObsOnce = vi.fn();
  const loadRealOnce = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    useHandsPageDataActionsMock.mockReturnValue({
      onReset: "reset-fn",
      onImportXml: "import-fn",
      onRunBatch: "batch-from-data",
      onRunOneForImage: "one-from-data",
    });

    useHandsPageWorkerActionsMock.mockReturnValue({
      onToggleWorkers: "toggle-fn",
      onWorkersTick: "tick-fn",
      onRunBatch: "batch-from-worker",
      onRunOneForImage: "one-from-worker",
    });
  });

  it("pasa los args correctos a dataActions y workerActions", () => {
    renderHook(() =>
      useHandsPageActions({
        mode: "REAL",
        safeDbPath: "C:\\db\\poker_boss.db",
        workersRunning: true,
        setWorkersRunning,
        setBusy,
        setActionStatus,
        setLastLog,
        loadObsOnce,
        loadRealOnce,
      })
    );

    expect(useHandsPageDataActionsMock).toHaveBeenCalledWith({
      mode: "REAL",
      safeDbPath: "C:\\db\\poker_boss.db",
      setBusy,
      setActionStatus,
      setLastLog,
      loadObsOnce,
      loadRealOnce,
    });

    expect(useHandsPageWorkerActionsMock).toHaveBeenCalledWith({
      safeDbPath: "C:\\db\\poker_boss.db",
      workersRunning: true,
      setWorkersRunning,
      setBusy,
      setActionStatus,
      setLastLog,
      loadObsOnce,
    });
  });

  it("mezcla resultados de ambos hooks", () => {
    const { result } = renderHook(() =>
      useHandsPageActions({
        mode: "OBS",
        safeDbPath: "C:\\db\\poker_boss.db",
        workersRunning: false,
        setWorkersRunning,
        setBusy,
        setActionStatus,
        setLastLog,
        loadObsOnce,
        loadRealOnce,
      })
    );

    expect(result.current.onReset).toBe("reset-fn");
    expect(result.current.onImportXml).toBe("import-fn");
    expect(result.current.onToggleWorkers).toBe("toggle-fn");
    expect(result.current.onWorkersTick).toBe("tick-fn");
  });

  it("prioriza claves del worker cuando hay colisión por spread final", () => {
    const { result } = renderHook(() =>
      useHandsPageActions({
        mode: "OBS",
        safeDbPath: "C:\\db\\poker_boss.db",
        workersRunning: false,
        setWorkersRunning,
        setBusy,
        setActionStatus,
        setLastLog,
        loadObsOnce,
        loadRealOnce,
      })
    );

    expect(result.current.onRunBatch).toBe("batch-from-worker");
    expect(result.current.onRunOneForImage).toBe("one-from-worker");
  });
});
