import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

let mockHandsPageState: any;

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("../pages/hands/useHandsPage", () => ({
  useHandsPage: () => mockHandsPageState,
}));

vi.mock("../pages/hands/HandsToolbar", () => ({
  default: () => <div data-testid="hands-toolbar" />,
}));

vi.mock("../pages/hands/HandsFourTables", () => ({
  TournamentsTable: () => <div data-testid="tournaments-table" />,
  HandsTableBlock: ({ mode, canRunOne }: { mode: string; canRunOne?: boolean }) => (
    <div
      data-testid={mode === "REAL" ? "real-hands-table" : "hands-table"}
      data-canrunone={String(canRunOne)}
    >
      {mode}
    </div>
  ),
  SpotsRealTable: () => <div data-testid="spots-real-table" />,
  PlayersTableBlock: () => <div data-testid="players-table" />,
}));

vi.mock("../pages/hands/HandsTable", () => ({
  HandsTable: () => null,
  default: () => null,
}));

vi.mock("../pages/hands/RealHandsTable", () => ({
  default: () => <div data-testid="real-hands-table" />,
}));

import HandsPage from "../pages/HandsPage";

describe("HandsPage OBS mode integration", () => {
  beforeEach(() => {
    mockHandsPageState = {
      mode: "OBS",
      setMode: vi.fn(),
      dbPath: "C:\\db\\default.db",
      setDbPath: vi.fn(),
      auto: true,
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
      obsFooterText: "range warning",
      sortedObsRows: [{ id: 1 }],
      sortedRealRows: [],
      loadOnce: vi.fn(),
      onReset: vi.fn(),
      onRunBatch: vi.fn(),
      onRunOneForImage: vi.fn(),
      onImportXml: vi.fn(),
      onWorkersTick: vi.fn(),
      tournaments: [],
      spotsReal: [],
      players: [],
    };
  });

  it("renders HandsTable and not REAL controls in OBS mode", () => {
    render(<HandsPage />);

    expect(screen.getByTestId("hands-table")).toBeTruthy();
    expect(screen.queryByTestId("real-hands-table")).toBeNull();
  });

  it("passes canRunOne=true to HandsTable when OBS + canLoad + not busy", () => {
    render(<HandsPage />);
    const handsBlock = screen.getByTestId("hands-table");
    expect(handsBlock.getAttribute("data-canrunone")).toBe("true");
  });

  it("shows obsFooterText when present", () => {
    render(<HandsPage />);

    expect(screen.getByText("range warning")).toBeTruthy();
  });

  it("passes canRunOne=false when busy", () => {
    mockHandsPageState.busy = true;

    render(<HandsPage />);
    const handsBlock = screen.getByTestId("hands-table");
    expect(handsBlock.getAttribute("data-canrunone")).toBe("false");
  });
});
