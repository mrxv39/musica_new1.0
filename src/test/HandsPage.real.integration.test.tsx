import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockOnToggleWorkers = vi.fn();

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
    tournaments: [],
    spotsReal: [],
    players: [],
    loadOnce: vi.fn(),
    loadAllFourTables: vi.fn(),
    onReset: vi.fn(),
    onRunBatch: vi.fn(),
    onRunOneForImage: vi.fn(),
    onImportXml: vi.fn(),
    onWorkersTick: vi.fn(),
  };
});

import HandsPage from "../pages/HandsPage";

describe("HandsPage REAL mode integration", () => {
  it("renders REAL controls and real table", () => {
    render(<HandsPage />);

    expect(screen.getByRole("button", { name: /Run workers \(loop/ })).toBeTruthy();
    expect(screen.getByTestId("real-hands-table")).toBeTruthy();
  });

  it("shows Stop workers label when workersRunning is true", () => {
    mockHandsPageState.workersRunning = true;

    render(<HandsPage />);

    fireEvent.click(screen.getByRole("button", { name: /Stop workers/ }));
    expect(mockOnToggleWorkers).toHaveBeenCalledTimes(1);
  });
});

