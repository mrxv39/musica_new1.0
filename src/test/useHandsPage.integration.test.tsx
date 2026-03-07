import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockObsSetDbPath = vi.fn();
const mockObsLoadOnce = vi.fn();
const mockRealLoadOnce = vi.fn();

const mockOnReset = vi.fn();
const mockOnRunBatch = vi.fn();
const mockOnRunOneForImage = vi.fn();
const mockOnToggleWorkers = vi.fn();
const mockOnImportXml = vi.fn();
const mockOnWorkersTick = vi.fn();

let mockWorkersPolling = {
  workersRunning: false,
  setWorkersRunning: vi.fn(),
  workersStatusText: "",
};

let mockObs = {
  rows: [{ id: 1 }, { id: 2 }],
  status: "obs ok",
  setDbPath: mockObsSetDbPath,
  loadOnce: mockObsLoadOnce,
};

let mockReal = {
  rows: [{ id: 10 }],
  status: "real ok",
  loadOnce: mockRealLoadOnce,
};

let mockSortState = {
  sortKey: "id",
  sortAsc: true,
  onSort: vi.fn(),
};

let mockFiltered = {
  rows: [{ id: 2 }, { id: 1 }],
  rangeError: "",
};

vi.mock("../db", () => ({
  DEFAULT_DB_PATH: "C:\\db\\default.db",
}));

vi.mock("../pages/hands/useHandsObs", () => ({
  useHandsObs: () => mockObs,
}));

vi.mock("../pages/hands/useHandsReal", () => ({
  useHandsReal: () => mockReal,
}));

vi.mock("../pages/hands/useHandsSort", () => ({
  useHandsSort: () => mockSortState,
}));

vi.mock("../pages/hands/useWorkersPolling", () => ({
  useWorkersPolling: () => mockWorkersPolling,
}));

vi.mock("../pages/hands/sortHands", () => ({
  sortHands: (rows: unknown[]) => rows,
}));

vi.mock("../pages/hands/handsFilters", () => ({
  parseNumericRange: (s: string) => s || null,
  filterHandsByAllFilters: () => mockFiltered,
}));

vi.mock("../pages/hands/handsPagePaths", () => ({
  summarize: (s: string) => s,
}));

vi.mock("../pages/hands/handsPageUtils", () => ({
  ensureNonEmptyPath: (p: string, fallback: string) => {
    const v = String(p || "").trim();
    return v ? v : fallback;
  },
}));

vi.mock("../pages/hands/useHandsPageActions", () => ({
  useHandsPageActions: () => ({
    onReset: mockOnReset,
    onRunBatch: mockOnRunBatch,
    onRunOneForImage: mockOnRunOneForImage,
    onToggleWorkers: mockOnToggleWorkers,
    onImportXml: mockOnImportXml,
    onWorkersTick: mockOnWorkersTick,
  }),
}));

import { useHandsPage } from "../pages/hands/useHandsPage";

describe("useHandsPage integration", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();

    mockWorkersPolling = {
      workersRunning: false,
      setWorkersRunning: vi.fn(),
      workersStatusText: "",
    };

    mockObs = {
      rows: [{ id: 1 }, { id: 2 }],
      status: "obs ok",
      setDbPath: mockObsSetDbPath,
      loadOnce: mockObsLoadOnce,
    };

    mockReal = {
      rows: [{ id: 10 }],
      status: "real ok",
      loadOnce: mockRealLoadOnce,
    };

    mockSortState = {
      sortKey: "id",
      sortAsc: true,
      onSort: vi.fn(),
    };

    mockFiltered = {
      rows: [{ id: 2 }, { id: 1 }],
      rangeError: "",
    };
  });

  it("loads persisted mode/dbPath/auto from localStorage", () => {
    localStorage.setItem("hands.mode", "REAL");
    localStorage.setItem("dbPath", "C:\\db\\saved.db");
    localStorage.setItem("autoRefresh", "false");

    const { result } = renderHook(() => useHandsPage());

    expect(result.current.mode).toBe("REAL");
    expect(result.current.dbPath).toBe("C:\\db\\saved.db");
    expect(result.current.auto).toBe(false);
  });

  it("persists mode/dbPath/auto when changed", async () => {
    const { result } = renderHook(() => useHandsPage());

    await act(async () => {
      result.current.setMode("REAL");
      result.current.setDbPath("C:\\db\\next.db");
      result.current.setAuto(false);
    });

    expect(localStorage.getItem("hands.mode")).toBe("REAL");
    expect(localStorage.getItem("dbPath")).toBe("C:\\db\\next.db");
    expect(localStorage.getItem("autoRefresh")).toBe("false");
  });

  it("calls obs.setDbPath when dbPath changes", async () => {
    const { result } = renderHook(() => useHandsPage());

    await act(async () => {
      result.current.setDbPath("C:\\db\\newer.db");
    });

    expect(mockObsSetDbPath).toHaveBeenCalled();
    expect(mockObsSetDbPath).toHaveBeenLastCalledWith("C:\\db\\newer.db");
  });

  it("loadOnce delegates to obs in OBS mode", async () => {
    const { result } = renderHook(() => useHandsPage());

    await act(async () => {
      await result.current.loadOnce();
    });

    expect(mockObsLoadOnce).toHaveBeenCalledTimes(1);
    expect(mockRealLoadOnce).not.toHaveBeenCalled();
  });

  it("loadOnce delegates to real in REAL mode", async () => {
    localStorage.setItem("hands.mode", "REAL");

    const { result } = renderHook(() => useHandsPage());

    await act(async () => {
      await result.current.loadOnce();
    });

    expect(mockRealLoadOnce).toHaveBeenCalledTimes(1);
    expect(mockObsLoadOnce).not.toHaveBeenCalled();
  });

  it("uiStatus prioritizes workers status over obs/real status when running", () => {
    mockWorkersPolling = {
      workersRunning: true,
      setWorkersRunning: vi.fn(),
      workersStatusText: "workers running | pid=1",
    };

    const { result } = renderHook(() => useHandsPage());

    expect(result.current.uiStatus).toBe("workers running | pid=1");
  });

  it("uiStatus uses real status in REAL mode when workers are not running", () => {
    localStorage.setItem("hands.mode", "REAL");
    mockReal.status = "real status here";

    const { result } = renderHook(() => useHandsPage());

    expect(result.current.uiStatus).toBe("real status here");
  });

  it("uiStatus uses obs status in OBS mode when idle", () => {
    mockObs.status = "obs status here";

    const { result } = renderHook(() => useHandsPage());

    expect(result.current.uiStatus).toBe("obs status here");
  });

  it("exposes filtered rangeError as obsFooterText", () => {
    mockFiltered = {
      rows: [],
      rangeError: "bad range",
    };

    const { result } = renderHook(() => useHandsPage());

    expect(result.current.obsFooterText).toBe("bad range");
  });

  it("onClearFilters clears state and persists empty strings", async () => {
    localStorage.setItem("hands.stackEfRangeText", "20-40");
    localStorage.setItem("hands.betRangeText", "2-3");
    localStorage.setItem("hands.rangeListText", "AK,QQ");

    const { result } = renderHook(() => useHandsPage());

    await act(async () => {
      result.current.setStackEfRangeText("20-40");
      result.current.setBetRangeText("2-3");
      result.current.setRangeListText("AK,QQ");
    });

    await act(async () => {
      result.current.onClearFilters();
    });

    expect(result.current.stackEfRangeText).toBe("");
    expect(result.current.betRangeText).toBe("");
    expect(result.current.rangeListText).toBe("");
    expect(localStorage.getItem("hands.stackEfRangeText")).toBe("");
    expect(localStorage.getItem("hands.betRangeText")).toBe("");
    expect(localStorage.getItem("hands.rangeListText")).toBe("");
  });

  it("canLoad is false when dbPath is blank", async () => {
    const { result } = renderHook(() => useHandsPage());

    await act(async () => {
      result.current.setDbPath("   ");
    });

    expect(result.current.canLoad).toBe(false);
  });
});
