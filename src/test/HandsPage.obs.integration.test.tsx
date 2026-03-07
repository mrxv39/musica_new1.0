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

vi.mock("../pages/hands/HandsTable", () => ({
  default: ({ canRunOne, dbPath }: { canRunOne: boolean; dbPath: string }) => (
    <div data-testid="hands-table">
      canRunOne={String(canRunOne)}|db={dbPath}
    </div>
  ),
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
    };
  });

  it("renders HandsTable and not REAL controls in OBS mode", () => {
    render(<HandsPage />);

    expect(screen.getByTestId("hands-table")).toBeTruthy();
    expect(screen.queryByTestId("real-hands-table")).toBeNull();
    expect(screen.queryByRole("button", { name: "Import XML" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Match Images" })).toBeNull();
  });

  it("passes canRunOne=true to HandsTable when OBS + canLoad + not busy", () => {
    render(<HandsPage />);

    expect(screen.getByTestId("hands-table").textContent).toContain("canRunOne=true");
  });

  it("shows obsFooterText when present", () => {
    render(<HandsPage />);

    expect(screen.getByText("range warning")).toBeTruthy();
  });

  it("passes canRunOne=false when busy", () => {
    mockHandsPageState.busy = true;

    render(<HandsPage />);

    expect(screen.getByTestId("hands-table").textContent).toContain("canRunOne=false");
  });
});
