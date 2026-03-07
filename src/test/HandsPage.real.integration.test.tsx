import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const invokeMock = vi.fn();
const alertMock = vi.fn();

const mockLoadOnce = vi.fn();
const mockOnToggleWorkers = vi.fn();
const mockOnImportXml = vi.fn();

let mockHandsPageState: any;

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

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
    onToggleWorkers: mockOnToggleWorkers,
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
    loadOnce: mockLoadOnce,
    onReset: vi.fn(),
    onRunBatch: vi.fn(),
    onRunOneForImage: vi.fn(),
    onImportXml: mockOnImportXml,
    onWorkersTick: vi.fn(),
  };
});

import HandsPage from "../pages/HandsPage";

describe("HandsPage REAL mode integration", () => {
  it("renders REAL controls and real table", () => {
    render(<HandsPage />);

    expect(screen.getByRole("button", { name: "Run workers (loop)" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Import XML" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Match Images" })).toBeTruthy();
    expect(screen.getByTestId("real-hands-table")).toBeTruthy();
  });

  it("shows Stop workers label when workersRunning is true", () => {
    mockHandsPageState.workersRunning = true;

    render(<HandsPage />);

    fireEvent.click(screen.getByRole("button", { name: "Stop workers" }));
    expect(mockOnToggleWorkers).toHaveBeenCalledTimes(1);
  });

  it("clicking Import XML calls onImportXml", () => {
    render(<HandsPage />);

    fireEvent.click(screen.getByRole("button", { name: "Import XML" }));
    expect(mockOnImportXml).toHaveBeenCalledTimes(1);
  });

  it("clicking Match Images calls invoke and then loadOnce", async () => {
    invokeMock.mockResolvedValue("match ok");

    render(<HandsPage />);

    fireEvent.click(screen.getByRole("button", { name: "Match Images" }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledTimes(1);
    });

    expect(invokeMock).toHaveBeenCalledWith("match_spots", {
      dbPath: "C:\\Users\\Usuario\\Desktop\\proyectos\\poker_boss\\data\\poker_boss.db",
      spotsDir:
        "C:\\Users\\Usuario\\Desktop\\proyectos\\poker_boss\\data\\spots_raw\\time_spots\\20260305",
      windowMs: 60000,
    });

    await waitFor(() => {
      expect(mockLoadOnce).toHaveBeenCalledTimes(1);
      expect(alertMock).toHaveBeenCalled();
    });
  });

  it("match images falls back to poker_boss.db when dbPath is empty", async () => {
    invokeMock.mockResolvedValue("match ok");
    mockHandsPageState.dbPath = "";

    render(<HandsPage />);

    fireEvent.click(screen.getByRole("button", { name: "Match Images" }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("match_spots", {
        dbPath: "poker_boss.db",
        spotsDir:
          "C:\\Users\\Usuario\\Desktop\\proyectos\\poker_boss\\data\\spots_raw\\time_spots\\20260305",
        windowMs: 60000,
      });
    });
  });
});
