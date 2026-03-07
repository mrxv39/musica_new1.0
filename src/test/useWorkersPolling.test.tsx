import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockGetWorkersStatusState = vi.fn();

vi.mock("../pages/hands/workersClient", () => ({
  getWorkersStatusState: (...args: unknown[]) => mockGetWorkersStatusState(...args),
}));

import { useWorkersPolling } from "../pages/hands/useWorkersPolling";

describe("useWorkersPolling", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockGetWorkersStatusState.mockReset();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("polls immediately on mount and updates state", async () => {
    mockGetWorkersStatusState.mockResolvedValue({
      running: true,
      statusText: "workers running | pid=1",
    });

    const { result } = renderHook(() => useWorkersPolling(500));

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockGetWorkersStatusState).toHaveBeenCalledTimes(1);
    expect(result.current.workersRunning).toBe(true);
    expect(result.current.workersStatusText).toBe("workers running | pid=1");
  });

  it("polls again on interval", async () => {
    mockGetWorkersStatusState
      .mockResolvedValueOnce({
        running: false,
        statusText: "stopped",
      })
      .mockResolvedValueOnce({
        running: true,
        statusText: "workers running | pid=2",
      });

    const { result } = renderHook(() => useWorkersPolling(500));

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.workersRunning).toBe(false);
    expect(result.current.workersStatusText).toBe("stopped");

    await act(async () => {
      vi.advanceTimersByTime(500);
      await Promise.resolve();
    });

    expect(mockGetWorkersStatusState).toHaveBeenCalledTimes(2);
    expect(result.current.workersRunning).toBe(true);
    expect(result.current.workersStatusText).toBe("workers running | pid=2");
  });

  it("ignores polling errors and keeps previous state", async () => {
    mockGetWorkersStatusState
      .mockResolvedValueOnce({
        running: true,
        statusText: "workers running | pid=3",
      })
      .mockRejectedValueOnce(new Error("poll fail"));

    const { result } = renderHook(() => useWorkersPolling(500));

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.workersRunning).toBe(true);
    expect(result.current.workersStatusText).toBe("workers running | pid=3");

    await act(async () => {
      vi.advanceTimersByTime(500);
      await Promise.resolve();
    });

    expect(result.current.workersRunning).toBe(true);
    expect(result.current.workersStatusText).toBe("workers running | pid=3");
  });

  it("cleans interval on unmount", async () => {
    mockGetWorkersStatusState.mockResolvedValue({
      running: false,
      statusText: "stopped",
    });

    const clearSpy = vi.spyOn(window, "clearInterval");
    const { unmount } = renderHook(() => useWorkersPolling(500));

    await act(async () => {
      await Promise.resolve();
    });

    unmount();

    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });
});
