import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

let lastActionsArgs: any = null;

const mockObsSetDbPath = vi.fn();
const mockObsLoadOnce = vi.fn();
const mockRealLoadOnce = vi.fn();

let mockWorkersPolling = {
  workersRunning: false,
  setWorkersRunning: vi.fn(),
  workersStatusText: "",
};

let mockObs = {
  rows: [{ id: 1 }],
  status: "obs ok",
  setDbPath: mockObsSetDbPath,
  loadOnce: mockObsLoadOnce,
};

let mockReal = {
  rows: [{ id: 10 }],
  status: "real ok",
  loadOnce: mockRealLoadOnce,
};

vi.mock("../db", () => ({
  DEFAULT_DB_PATH: "C:\\db\\default.db",
  fetchTournaments: vi.fn().mockResolvedValue([]),
  fetchSpots: vi.fn().mockResolvedValue([]),
  fetchWorkerProfileSummary: vi.fn().mockResolvedValue([]),
}));

vi.mock("../pages/hands/useHandsObs", () => ({
  useHandsObs: () => mockObs,
}));

vi.mock("../pages/hands/useHandsReal", () => ({
  useHandsReal: () => mockReal,
}));

vi.mock("../pages/hands/useHandsSort", () => ({
  useHandsSort: () => ({
    sortKey: "id",
    sortAsc: true,
    onSort: vi.fn(),
  }),
}));

vi.mock("../pages/hands/sortHands", () => ({
  sortHands: (rows: unknown[]) => rows,
}));

vi.mock("../pages/hands/handsFilters", () => ({
  parseNumericRange: (s: string) => s || null,
  filterHandsByAllFilters: (rows: unknown[]) => ({
    rows,
    rangeError: "",
  }),
}));

vi.mock("../pages/hands/handsPageUtils", () => ({
  ensureNonEmptyPath: (p: string, fallback: string) => {
    const v = String(p || "").trim();
    return v ? v : fallback;
  },
}));

vi.mock("../pages/hands/useWorkersPolling", () => ({
  useWorkersPolling: () => mockWorkersPolling,
}));

vi.mock("../pages/hands/useHandsPageActions", () => ({
  useHandsPageActions: (args: any) => {
    lastActionsArgs = args;
    return {
      onReset: vi.fn(),
      onRunBatch: vi.fn(),
      onRunOneForImage: vi.fn(),
      onToggleWorkers: vi.fn(),
      onImportXml: vi.fn(),
      onWorkersTick: vi.fn(),
    };
  },
}));

import { useHandsPage } from "../pages/hands/useHandsPage";

describe("useHandsPage uiStatus priority", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    lastActionsArgs = null;

    mockWorkersPolling = {
      workersRunning: false,
      setWorkersRunning: vi.fn(),
      workersStatusText: "",
    };

    mockObs = {
      rows: [{ id: 1 }],
      status: "obs ok",
      setDbPath: mockObsSetDbPath,
      loadOnce: mockObsLoadOnce,
    };

    mockReal = {
      rows: [{ id: 10 }],
      status: "real ok",
      loadOnce: mockRealLoadOnce,
    };
  });

  it("prioriza actionStatus cuando busy=true", () => {
    const { result } = renderHook(() => useHandsPage());

    act(() => {
      lastActionsArgs.setActionStatus("acción en curso");
      lastActionsArgs.setBusy(true);
    });

    expect(result.current.uiStatus).toBe("acción en curso");
    expect(result.current.busy).toBe(true);
    expect(result.current.actionStatus).toBe("acción en curso");
  });

  it("si busy=false vuelve a workersStatusText cuando workers están running", () => {
    mockWorkersPolling = {
      workersRunning: true,
      setWorkersRunning: vi.fn(),
      workersStatusText: "workers corriendo",
    };

    const { result } = renderHook(() => useHandsPage());

    act(() => {
      lastActionsArgs.setActionStatus("acción en curso");
      lastActionsArgs.setBusy(true);
    });

    expect(result.current.uiStatus).toBe("acción en curso");

    act(() => {
      lastActionsArgs.setBusy(false);
    });

    expect(result.current.uiStatus).toBe("workers corriendo");
  });

  it("si busy=false y workers no corren vuelve a obs.status", () => {
    mockObs.status = "obs listo";
    mockWorkersPolling = {
      workersRunning: false,
      setWorkersRunning: vi.fn(),
      workersStatusText: "",
    };

    const { result } = renderHook(() => useHandsPage());

    act(() => {
      lastActionsArgs.setActionStatus("acción en curso");
      lastActionsArgs.setBusy(true);
    });

    expect(result.current.uiStatus).toBe("acción en curso");

    act(() => {
      lastActionsArgs.setBusy(false);
    });

    expect(result.current.uiStatus).toBe("obs listo");
  });

  it("lastLog se actualiza desde los setters que recibe useHandsPageActions", () => {
    const { result } = renderHook(() => useHandsPage());

    act(() => {
      lastActionsArgs.setLastLog("línea de log");
    });

    expect(result.current.lastLog).toBe("línea de log");
  });
});
