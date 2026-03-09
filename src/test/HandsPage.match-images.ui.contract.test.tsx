import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import HandsPage from "../pages/HandsPage";
import { SPOTS_OUT_BASE } from "../pages/hands/handsPagePaths";

const invokeMock = vi.fn();
const alertMock = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

let mockHandsPageState: any;

vi.mock("../pages/hands/useHandsPage", () => ({
  useHandsPage: () => mockHandsPageState,
}));

vi.mock("../pages/hands/HandsToolbar", () => ({
  default: () => <div data-testid="hands-toolbar" />,
}));

vi.mock("../pages/hands/HandsTable", () => ({
  default: () => <div data-testid="hands-table" />,
}));

vi.mock("../pages/hands/RealHandsTable", () => ({
  default: ({ rows, dbPath }: { rows: unknown[]; dbPath: string }) => (
    <div data-testid="real-hands-table">
      rows={rows.length}|db={dbPath}
    </div>
  ),
}));

describe("HandsPage match images UI contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("alert", alertMock);

    mockHandsPageState = {
      mode: "REAL",
      setMode: vi.fn(),
      dbPath: "C:\\Users\\Usuario\\Desktop\\proyectos\\poker_boss\\data\\poker_boss.db",
      setDbPath: vi.fn(),
      auto: false,
      setAuto: vi.fn(),
      canLoad: true,
      uiStatus: "",
      busy: false,
      actionStatus: "",
      lastLog: "",
      workersRunning: false,
      onToggleWorkers: vi.fn(),
      sortKey: "id",
      sortAsc: true,
      onSort: vi.fn(),
      stackEfRangeText: "",
      setStackEfRangeText: vi.fn(),
      betRangeText: "",
      setBetRangeText: vi.fn(),
      rangeListText: "",
      setRangeListText: vi.fn(),
      onClearFilters: vi.fn(),
      obsFooterText: "",
      sortedObsRows: [],
      sortedRealRows: [{ id: 1 }, { id: 2 }],
      loadOnce: vi.fn(),
      onReset: vi.fn(),
      onRunBatch: vi.fn(),
      onRunOneForImage: vi.fn(),
      onImportXml: vi.fn(),
      onWorkersTick: vi.fn(),
    };
  });

  it("click en Match Images llama match_spots con SPOTS_OUT_BASE y refresca", async () => {
    invokeMock.mockResolvedValueOnce("match ok");

    render(<HandsPage />);

    fireEvent.click(screen.getByRole("button", { name: "Match Images" }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledTimes(1);
    });

    expect(invokeMock).toHaveBeenCalledWith("match_spots", {
      dbPath: "C:\\Users\\Usuario\\Desktop\\proyectos\\poker_boss\\data\\poker_boss.db",
      spotsDir: SPOTS_OUT_BASE,
      windowMs: 60000,
    });

    await waitFor(() => {
      expect(alertMock).toHaveBeenCalledWith("match ok");
      expect(mockHandsPageState.loadOnce).toHaveBeenCalledTimes(1);
    });
  });

  it("si dbPath está vacío usa poker_boss.db", async () => {
    mockHandsPageState.dbPath = "";
    invokeMock.mockResolvedValueOnce("match ok");

    render(<HandsPage />);

    fireEvent.click(screen.getByRole("button", { name: "Match Images" }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("match_spots", {
        dbPath: "poker_boss.db",
        spotsDir: SPOTS_OUT_BASE,
        windowMs: 60000,
      });
    });
  });
});
