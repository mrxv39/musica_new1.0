import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

const mockOnToggleWorkers = vi.fn();

vi.mock("../pages/hands/useHandsPage", () => ({
  useHandsPage: () => ({
    mode: "REAL",
    setMode: vi.fn(),
    dbPath: "C:\\db\\default.db",
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
    sortedRealRows: [],
    loadOnce: vi.fn(),
    onReset: vi.fn(),
    onRunBatch: vi.fn(),
    onRunOneForImage: vi.fn(),
    onImportXml: vi.fn(),
    onWorkersTick: vi.fn(),
  }),
}));

vi.mock("../pages/hands/HandsToolbar", () => ({
  default: () => <div data-testid="hands-toolbar" />,
}));

vi.mock("../pages/hands/HandsTable", () => ({
  default: () => <div data-testid="hands-table" />,
}));

vi.mock("../pages/hands/RealHandsTable", () => ({
  default: () => <div data-testid="real-hands-table" />,
}));

import HandsPage from "../pages/HandsPage";

describe("HandsPage workers button", () => {
  beforeEach(() => {
    mockOnToggleWorkers.mockReset();
  });

  it("clicking Run workers (loop) calls onToggleWorkers", () => {
    render(<HandsPage />);

    fireEvent.click(screen.getByRole("button", { name: "Run workers (loop)" }));

    expect(mockOnToggleWorkers).toHaveBeenCalledTimes(1);
  });
});
