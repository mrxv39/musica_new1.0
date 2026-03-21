import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { getHandsDefaultDbPath } from "../config";
import { useHandsPage } from "../pages/hands/useHandsPage";

const obsMock = {
  rows: [] as any[],
  status: "obs-status",
  setDbPath: vi.fn(),
  loadOnce: vi.fn(),
};

const realMock = {
  rows: [] as any[],
  status: "real-status",
  loadOnce: vi.fn(),
};

const workersPollingMock = {
  workersRunning: false,
  setWorkersRunning: vi.fn(),
  workersStatusText: "",
};

const actionsMock = {
  onReset: vi.fn(),
  onRunBatch: vi.fn(),
  onRunOneForImage: vi.fn(),
  onToggleWorkers: vi.fn(),
  onImportXml: vi.fn(),
  onWorkersTick: vi.fn(),
};

const useHandsPageActionsSpy = vi.fn();

vi.mock("../pages/hands/useHandsObs", () => ({
  useHandsObs: () => obsMock,
}));

vi.mock("../pages/hands/useHandsReal", () => ({
  useHandsReal: () => realMock,
}));

vi.mock("../pages/hands/useWorkersPolling", () => ({
  useWorkersPolling: () => workersPollingMock,
}));

vi.mock("../pages/hands/useHandsPageActions", () => ({
  useHandsPageActions: (args: any) => {
    useHandsPageActionsSpy(args);
    return actionsMock;
  },
}));

describe("useHandsPage more integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    obsMock.rows = [];
    obsMock.status = "obs-status";
    obsMock.setDbPath.mockReset();
    obsMock.loadOnce.mockReset();

    realMock.rows = [];
    realMock.status = "real-status";
    realMock.loadOnce.mockReset();

    workersPollingMock.workersRunning = false;
    workersPollingMock.workersStatusText = "";
    workersPollingMock.setWorkersRunning.mockReset();
  });

  it("loadOnce usa obs.loadOnce (modo siempre OBS)", async () => {
    const { result } = renderHook(() => useHandsPage());

    await act(async () => {
      await result.current.loadOnce();
    });

    expect(obsMock.loadOnce).toHaveBeenCalled();
  });

  it("uiStatus usa obs.status cuando no hay busy ni workers (modo siempre OBS)", () => {
    obsMock.status = "obs listo";
    realMock.status = "real listo";
    workersPollingMock.workersRunning = false;
    workersPollingMock.workersStatusText = "";

    const { result } = renderHook(() => useHandsPage());

    expect(result.current.uiStatus).toBe("obs listo");
  });

  it("uiStatus prioriza workersStatusText cuando workersRunning=true", () => {
    localStorage.setItem("hands.mode", "OBS");
    obsMock.status = "obs listo";
    workersPollingMock.workersRunning = true;
    workersPollingMock.workersStatusText = "workers corriendo";

    const { result } = renderHook(() => useHandsPage());

    expect(result.current.uiStatus).toBe("workers corriendo");
  });

  it("canLoad es siempre true (DB fija por config)", () => {
    const { result } = renderHook(() => useHandsPage());
    expect(result.current.canLoad).toBe(true);
  });

  it("al montar llama obs.setDbPath con la ruta por defecto", async () => {
    renderHook(() => useHandsPage());

    await waitFor(() => {
      expect(obsMock.setDbPath).toHaveBeenCalledWith(getHandsDefaultDbPath());
    });
  });

  it("sortedRealRows expone real.rows", () => {
    realMock.rows = [{ id: 1 }, { id: 2 }] as any[];

    const { result } = renderHook(() => useHandsPage());

    expect(result.current.sortedRealRows).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it("onClearFilters limpia textos y borra localStorage", () => {
    localStorage.setItem("hands.stackEfRangeText", "10-20");
    localStorage.setItem("hands.betRangeText", "2-5");
    localStorage.setItem("hands.rangeListText", "22+,AJs+");

    const { result } = renderHook(() => useHandsPage());

    act(() => {
      result.current.onClearFilters();
    });

    expect(result.current.stackEfRangeText).toBe("");
    expect(result.current.betRangeText).toBe("");
    expect(result.current.rangeListText).toBe("");
    expect(localStorage.getItem("hands.stackEfRangeText")).toBe("");
    expect(localStorage.getItem("hands.betRangeText")).toBe("");
    expect(localStorage.getItem("hands.rangeListText")).toBe("");
  });

  it("useHandsPageActions recibe safeDbPath saneado cuando dbPath está vacío", () => {
    localStorage.setItem("dbPath", "");

    renderHook(() => useHandsPage());

    const args = useHandsPageActionsSpy.mock.calls.at(-1)?.[0];
    expect(args).toBeTruthy();
    expect(args.safeDbPath).toBeTruthy();
    expect(String(args.safeDbPath).trim().length).toBeGreaterThan(0);
  });

  it("useHandsPageActions recibe callbacks base correctos", () => {
    renderHook(() => useHandsPage());

    const args = useHandsPageActionsSpy.mock.calls.at(-1)?.[0];
    expect(args).toBeTruthy();
    expect(args.mode).toBe("OBS");
    expect(typeof args.setBusy).toBe("function");
    expect(typeof args.setActionStatus).toBe("function");
    expect(typeof args.setLastLog).toBe("function");
    expect(typeof args.loadObsOnce).toBe("function");
    expect(typeof args.loadRealOnce).toBe("function");
  });
});

