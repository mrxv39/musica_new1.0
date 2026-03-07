import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import HandsPage from "../pages/HandsPage";

const invokeMock = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: any[]) => invokeMock(...args),
}));

const useHandsPageMock = vi.fn();

vi.mock("../pages/hands/useHandsPage", () => ({
  useHandsPage: () => useHandsPageMock(),
}));

vi.mock("../pages/hands/HandsToolbar", () => ({
  default: () => <div data-testid="hands-toolbar">toolbar</div>,
}));

vi.mock("../pages/hands/HandsTable", () => ({
  default: () => <div data-testid="hands-table">obs-table</div>,
}));

vi.mock("../pages/hands/RealHandsTable", () => ({
  default: () => <div data-testid="real-hands-table">real-table</div>,
}));

function makeHp(overrides: Record<string, any> = {}) {
  return {
    mode: "REAL",
    setMode: vi.fn(),

    dbPath: "C:\\db.sqlite",
    setDbPath: vi.fn(),

    canLoad: true,
    busy: false,
    auto: false,
    setAuto: vi.fn(),

    uiStatus: "",
    onReset: vi.fn(),
    onRunBatch: vi.fn(),

    workersRunning: false,
    onToggleWorkers: vi.fn(),

    stackEfRangeText: "",
    setStackEfRangeText: vi.fn(),

    betRangeText: "",
    setBetRangeText: vi.fn(),

    rangeListText: "",
    setRangeListText: vi.fn(),

    onClearFilters: vi.fn(),

    onImportXml: vi.fn(),
    loadOnce: vi.fn(),

    sortedRealRows: [],
    sortedObsRows: [],
    onSort: vi.fn(),
    sortKey: "id",
    sortAsc: true,
    onRunOneForImage: vi.fn(),

    obsFooterText: "",
    actionStatus: "",
    lastLog: "",

    ...overrides,
  };
}

describe("HandsPage match images errors", () => {
  const alertMock = vi.fn();
  const consoleLogMock = vi.fn();
  const consoleErrorMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useHandsPageMock.mockReturnValue(makeHp());
    invokeMock.mockReset();

    vi.stubGlobal("alert", alertMock);
    vi.spyOn(console, "log").mockImplementation(consoleLogMock);
    vi.spyOn(console, "error").mockImplementation(consoleErrorMock);
  });

  it("deshabilita Match Images cuando canLoad=false", () => {
    useHandsPageMock.mockReturnValue(
      makeHp({
        canLoad: false,
      })
    );

    render(<HandsPage />);

    const btn = screen.getByRole("button", { name: "Match Images" }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("deshabilita Match Images cuando busy=true", () => {
    useHandsPageMock.mockReturnValue(
      makeHp({
        busy: true,
      })
    );

    render(<HandsPage />);

    const btn = screen.getByRole("button", { name: "Match Images" }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("llama match_spots con dbPath explícito y luego loadOnce", async () => {
    const hp = makeHp({
      dbPath: "C:\\db.sqlite",
    });
    useHandsPageMock.mockReturnValue(hp);
    invokeMock.mockResolvedValueOnce("match ok");

    render(<HandsPage />);

    fireEvent.click(screen.getByRole("button", { name: "Match Images" }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledTimes(1);
    });

    expect(invokeMock).toHaveBeenCalledWith("match_spots", {
      dbPath: "C:\\db.sqlite",
      spotsDir:
        "C:\\Users\\Usuario\\Desktop\\proyectos\\poker_boss\\data\\spots_raw\\time_spots\\20260305",
      windowMs: 60000,
    });

    await waitFor(() => {
      expect(alertMock).toHaveBeenCalledWith("match ok");
    });

    expect(hp.loadOnce).toHaveBeenCalledTimes(1);
  });

  it("usa poker_boss.db cuando dbPath está vacío", async () => {
    const hp = makeHp({
      dbPath: "",
    });
    useHandsPageMock.mockReturnValue(hp);
    invokeMock.mockResolvedValueOnce("match ok");

    render(<HandsPage />);

    fireEvent.click(screen.getByRole("button", { name: "Match Images" }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledTimes(1);
    });

    expect(invokeMock).toHaveBeenCalledWith("match_spots", {
      dbPath: "poker_boss.db",
      spotsDir:
        "C:\\Users\\Usuario\\Desktop\\proyectos\\poker_boss\\data\\spots_raw\\time_spots\\20260305",
      windowMs: 60000,
    });
  });

  it("usa poker_boss.db cuando dbPath es solo espacios", async () => {
    const hp = makeHp({
      dbPath: "   ",
    });
    useHandsPageMock.mockReturnValue(hp);
    invokeMock.mockResolvedValueOnce("match ok");

    render(<HandsPage />);

    fireEvent.click(screen.getByRole("button", { name: "Match Images" }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledTimes(1);
    });

    expect(invokeMock).toHaveBeenCalledWith("match_spots", {
      dbPath: "poker_boss.db",
      spotsDir:
        "C:\\Users\\Usuario\\Desktop\\proyectos\\poker_boss\\data\\spots_raw\\time_spots\\20260305",
      windowMs: 60000,
    });
  });

  it('si invoke devuelve vacío, hace alert("Match Images OK") y loadOnce', async () => {
    const hp = makeHp();
    useHandsPageMock.mockReturnValue(hp);
    invokeMock.mockResolvedValueOnce("");

    render(<HandsPage />);

    fireEvent.click(screen.getByRole("button", { name: "Match Images" }));

    await waitFor(() => {
      expect(alertMock).toHaveBeenCalledWith("Match Images OK");
    });

    expect(hp.loadOnce).toHaveBeenCalledTimes(1);
  });

  it("si invoke falla con Error, muestra message y no llama loadOnce", async () => {
    const hp = makeHp();
    useHandsPageMock.mockReturnValue(hp);
    invokeMock.mockRejectedValueOnce(new Error("boom match"));

    render(<HandsPage />);

    fireEvent.click(screen.getByRole("button", { name: "Match Images" }));

    await waitFor(() => {
      expect(alertMock).toHaveBeenCalledWith("boom match");
    });

    expect(hp.loadOnce).not.toHaveBeenCalled();
    expect(consoleErrorMock).toHaveBeenCalled();
  });

  it("si invoke falla con string, muestra ese string y no llama loadOnce", async () => {
    const hp = makeHp();
    useHandsPageMock.mockReturnValue(hp);
    invokeMock.mockRejectedValueOnce("plain failure");

    render(<HandsPage />);

    fireEvent.click(screen.getByRole("button", { name: "Match Images" }));

    await waitFor(() => {
      expect(alertMock).toHaveBeenCalledWith("plain failure");
    });

    expect(hp.loadOnce).not.toHaveBeenCalled();
  });

  it("no renderiza botón Match Images en modo OBS", () => {
    useHandsPageMock.mockReturnValue(
      makeHp({
        mode: "OBS",
      })
    );

    render(<HandsPage />);

    expect(screen.queryByRole("button", { name: "Match Images" })).toBeNull();
  });
});
