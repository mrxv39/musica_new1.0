import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchLatestHandsObsMock = vi.fn();

vi.mock("../db", () => ({
  DEFAULT_DB_PATH: "C:\\db\\default.db",
  fetchLatestHandsObs: (...args: unknown[]) => fetchLatestHandsObsMock(...args),
}));

import { useHandsObs } from "../pages/hands/useHandsObs";

describe("useHandsObs", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("usa dbPath persistido o DEFAULT_DB_PATH", () => {
    const { result } = renderHook(() => useHandsObs());

    expect(result.current.dbPath).toBe("C:\\db\\default.db");
  });

  it("loadOnce trae rows y status ok y persiste dbPath trimmeado", async () => {
    fetchLatestHandsObsMock.mockResolvedValue([{ id: 1 }, { id: 2 }]);

    const { result } = renderHook(() => useHandsObs());

    await act(async () => {
      result.current.setDbPath("  C:\\db\\obs.db  ");
    });

    await act(async () => {
      await result.current.loadOnce();
    });

    await waitFor(() => {
      expect(result.current.rows).toEqual([{ id: 1 }, { id: 2 }]);
    });

    expect(fetchLatestHandsObsMock).toHaveBeenLastCalledWith("C:\\db\\obs.db", 500, null);
    expect(result.current.status).toBe("ok (2)");
    expect(localStorage.getItem("dbPath")).toBe("C:\\db\\obs.db");
  });

  it("loadOnce no llama fetch si dbPath queda vacío", async () => {
    fetchLatestHandsObsMock.mockResolvedValue([]);

    const { result } = renderHook(() => useHandsObs());

    await waitFor(() => {
      expect(fetchLatestHandsObsMock).toHaveBeenCalledTimes(1);
    });

    fetchLatestHandsObsMock.mockClear();

    await act(async () => {
      result.current.setDbPath("   ");
    });

    await act(async () => {
      await result.current.loadOnce();
    });

    expect(fetchLatestHandsObsMock).not.toHaveBeenCalled();
  });

  it("loadOnce pone ERROR y vacía rows si fetch falla", async () => {
    fetchLatestHandsObsMock.mockResolvedValue([]);
    const { result } = renderHook(() => useHandsObs());

    await waitFor(() => {
      expect(fetchLatestHandsObsMock).toHaveBeenCalledTimes(1);
    });

    fetchLatestHandsObsMock.mockReset();
    fetchLatestHandsObsMock.mockRejectedValue(new Error("obs fail"));

    await act(async () => {
      await result.current.loadOnce();
    });

    await waitFor(() => {
      expect(result.current.status).toBe("ERROR: obs fail");
    });

    expect(result.current.rows).toEqual([]);
  });

  it("canLoad refleja si dbPath tiene contenido real", async () => {
    const { result } = renderHook(() => useHandsObs());

    expect(result.current.canLoad).toBe(true);

    await act(async () => {
      result.current.setDbPath("   ");
    });

    expect(result.current.canLoad).toBe(false);
  });

  it("persiste autoRefresh al cambiar auto", async () => {
    const { result } = renderHook(() => useHandsObs());

    await act(async () => {
      result.current.setAuto(false);
    });

    expect(localStorage.getItem("autoRefresh")).toBe("false");
  });

  it("si auto=true programa recarga cada 1500ms", async () => {
    vi.useFakeTimers();
    fetchLatestHandsObsMock.mockResolvedValue([]);

    renderHook(() => useHandsObs());

    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });

    const initialCalls = fetchLatestHandsObsMock.mock.calls.length;

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });

    expect(fetchLatestHandsObsMock.mock.calls.length).toBeGreaterThan(initialCalls);
  });

  it("si auto=false no programa ticks extra", async () => {
    vi.useFakeTimers();
    localStorage.setItem("autoRefresh", "false");
    fetchLatestHandsObsMock.mockResolvedValue([]);

    renderHook(() => useHandsObs());

    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });

    const callsAfterMount = fetchLatestHandsObsMock.mock.calls.length;

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(fetchLatestHandsObsMock.mock.calls.length).toBe(callsAfterMount);
  });
});
