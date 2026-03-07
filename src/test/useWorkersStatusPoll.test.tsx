import { renderHook } from "@testing-library/react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const invokeMock = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

import { useWorkersStatusPoll } from "../pages/hands/useWorkersStatusPoll";

describe("useWorkersStatusPoll", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    invokeMock.mockReset();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("does not poll when workersRunning is false", async () => {
    const setLastLog = vi.fn();

    renderHook(() => useWorkersStatusPoll(false, setLastLog));

    await act(async () => {
      vi.advanceTimersByTime(2000);
      await Promise.resolve();
    });

    expect(invokeMock).not.toHaveBeenCalled();
    expect(setLastLog).not.toHaveBeenCalled();
  });

  it("polls on interval when workersRunning is true", async () => {
    invokeMock.mockResolvedValue("workers running | pid=10");
    const setLastLog = vi.fn();

    renderHook(() => useWorkersStatusPoll(true, setLastLog));

    await act(async () => {
      vi.advanceTimersByTime(700);
      await Promise.resolve();
    });

    expect(invokeMock).toHaveBeenCalledWith("get_workers_status");
    expect(setLastLog).toHaveBeenCalledWith("workers running | pid=10");
  });

  it("ignores invoke errors", async () => {
    invokeMock.mockRejectedValue(new Error("poll error"));
    const setLastLog = vi.fn();

    renderHook(() => useWorkersStatusPoll(true, setLastLog));

    await act(async () => {
      vi.advanceTimersByTime(700);
      await Promise.resolve();
    });

    expect(invokeMock).toHaveBeenCalledWith("get_workers_status");
    expect(setLastLog).not.toHaveBeenCalled();
  });

  it("stops polling when rerendered with workersRunning=false", async () => {
    invokeMock.mockResolvedValue("workers running | pid=11");
    const setLastLog = vi.fn();
    const clearSpy = vi.spyOn(window, "clearInterval");

    const { rerender } = renderHook(
      ({ running }) => useWorkersStatusPoll(running, setLastLog),
      { initialProps: { running: true } }
    );

    await act(async () => {
      vi.advanceTimersByTime(700);
      await Promise.resolve();
    });

    rerender({ running: false });

    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });
});
