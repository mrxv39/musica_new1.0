import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchLatestHandsRealMock = vi.fn();

vi.mock("../db", () => ({
  fetchLatestHandsReal: (...args: unknown[]) => fetchLatestHandsRealMock(...args),
}));

import { useHandsReal } from "../pages/hands/useHandsReal";

describe("useHandsReal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("loadOnce trae rows y status ok", async () => {
    fetchLatestHandsRealMock.mockResolvedValue([{ id: 10 }, { id: 11 }]);

    const { result } = renderHook(() => useHandsReal("C:\\db\\real.db", false));

    await act(async () => {
      await result.current.loadOnce();
    });

    await waitFor(() => {
      expect(result.current.rows).toEqual([{ id: 10 }, { id: 11 }]);
    });

    expect(fetchLatestHandsRealMock).toHaveBeenLastCalledWith("C:\\db\\real.db", 250);
    expect(result.current.status).toBe("ok (2)");
  });

  it("loadOnce no llama fetch si dbPath queda vacío", async () => {
    const { result } = renderHook(() => useHandsReal("   ", false));

    await act(async () => {
      await result.current.loadOnce();
    });

    expect(fetchLatestHandsRealMock).not.toHaveBeenCalled();
  });

  it("loadOnce pone ERROR y vacía rows si fetch falla", async () => {
    fetchLatestHandsRealMock.mockResolvedValue([]);
    const { result } = renderHook(() => useHandsReal("C:\\db\\real.db", false));

    await waitFor(() => {
      expect(fetchLatestHandsRealMock).toHaveBeenCalledTimes(1);
    });

    fetchLatestHandsRealMock.mockReset();
    fetchLatestHandsRealMock.mockRejectedValue(new Error("real fail"));

    await act(async () => {
      await result.current.loadOnce();
    });

    await waitFor(() => {
      expect(result.current.status).toBe("ERROR: real fail");
    });

    expect(result.current.rows).toEqual([]);
  });

  it("canLoad refleja si dbPath tiene contenido real", () => {
    const { result, rerender } = renderHook(
      ({ dbPath, auto }) => useHandsReal(dbPath, auto),
      { initialProps: { dbPath: "C:\\db\\real.db", auto: false } }
    );

    expect(result.current.canLoad).toBe(true);

    rerender({ dbPath: "   ", auto: false });

    expect(result.current.canLoad).toBe(false);
  });

  it("si auto=true programa recarga cada 3000ms", async () => {
    vi.useFakeTimers();
    fetchLatestHandsRealMock.mockResolvedValue([]);

    renderHook(() => useHandsReal("C:\\db\\real.db", true));

    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });

    const initialCalls = fetchLatestHandsRealMock.mock.calls.length;

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    expect(fetchLatestHandsRealMock.mock.calls.length).toBeGreaterThan(initialCalls);
  });

  it("si auto=false no programa ticks extra", async () => {
    vi.useFakeTimers();
    fetchLatestHandsRealMock.mockResolvedValue([]);

    renderHook(() => useHandsReal("C:\\db\\real.db", false));

    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });

    const callsAfterMount = fetchLatestHandsRealMock.mock.calls.length;

    await act(async () => {
      await vi.advanceTimersByTimeAsync(7000);
    });

    expect(fetchLatestHandsRealMock.mock.calls.length).toBe(callsAfterMount);
  });
});
