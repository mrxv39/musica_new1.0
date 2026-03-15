import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockSetWorkersRunningCommand = vi.fn();
const mockRunWorkersTickCommand = vi.fn();
const mockSetWorkersRunning = vi.fn();

vi.mock("../config", () => ({
  getHandsDefaultDbPath: () => "C:\\db\\default.db",
  getPlayersDbUrl: () => "sqlite:C:/db/default.db",
}));

vi.mock("../pages/hands/useHandsObs", () => ({
  useHandsObs: () => ({
    rows: [],
    status: "obs ok",
    setDbPath: vi.fn(),
    loadOnce: vi.fn(),
  }),
}));

vi.mock("../pages/hands/useHandsReal", () => ({
  useHandsReal: () => ({
    rows: [],
    status: "real ok",
    loadOnce: vi.fn(),
  }),
}));

vi.mock("../pages/hands/sortHands", () => ({
  sortHands: (rows: unknown[]) => rows,
}));

vi.mock("../pages/hands/useHandsSort", () => ({
  useHandsSort: () => ({
    sortKey: "id",
    sortAsc: true,
    onSort: vi.fn(),
  }),
}));

vi.mock("../pages/hands/handsFilters", () => ({
  filterHandsByAllFilters: (rows: unknown[]) => ({
    rows,
    rangeError: "",
  }),
  parseNumericRange: () => null,
}));

vi.mock("../pages/hands/handsPagePaths", () => ({
  BATCH_FOLDER_PATH: "C:\\batch",
  CHAMPION_HERO: "hero",
  CHAMPION_XML_DIR: "C:\\xml",
  XML_ARCHIVE_DIR: "C:\\archive",
  summarize: (s: string) => s,
}));

vi.mock("../pages/hands/handsPageUtils", () => ({
  buildWorkersOutDir: () => "C:\\tmp\\workers_out",
  ensureNonEmptyPath: (p: string, d: string) => (p && p.trim() ? p : d),
  getErrorMessage: (e: unknown) => String(e),
}));

vi.mock("../pages/hands/workersClient", () => ({
  setWorkersRunningCommand: (...args: unknown[]) => mockSetWorkersRunningCommand(...args),
  runWorkersTickCommand: (...args: unknown[]) => mockRunWorkersTickCommand(...args),
}));

vi.mock("../pages/hands/useWorkersPolling", () => ({
  useWorkersPolling: () => ({
    workersRunning: false,
    setWorkersRunning: mockSetWorkersRunning,
    workersStatusText: "",
  }),
}));

import { useHandsPage } from "../pages/hands/useHandsPage";

describe("useHandsPage workers", () => {
  beforeEach(() => {
    localStorage.clear();
    mockSetWorkersRunningCommand.mockReset();
    mockRunWorkersTickCommand.mockReset();
    mockSetWorkersRunning.mockReset();
  });

  it("onToggleWorkers calls setWorkersRunningCommand with loop args", async () => {
    mockSetWorkersRunningCommand.mockResolvedValue("workers started");

    const { result } = renderHook(() => useHandsPage());

    await act(async () => {
      await result.current.onToggleWorkers();
    });

    expect(mockSetWorkersRunningCommand).toHaveBeenCalledTimes(1);
    expect(mockSetWorkersRunningCommand).toHaveBeenCalledWith({
      running: true,
      dbPath: "C:\\db\\default.db",
      outDir: "C:\\tmp\\workers_out",
      intervalMs: 3000,
      xmlDir: "C:\\xml",
      hero: "hero",
    });

    expect(mockSetWorkersRunning).toHaveBeenCalledWith(true);
    expect(result.current.lastLog).toBe("workers started");
  });
});

