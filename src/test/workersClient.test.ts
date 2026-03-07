import { describe, expect, it, vi, beforeEach } from "vitest";

const invokeMock = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

vi.mock("../pages/hands/handsPageUtils", () => ({
  isWorkersRunningFromStatus: (statusText: string) => String(statusText).includes("workers running"),
}));

import {
  getWorkersStatusState,
  runWorkersTickCommand,
  setWorkersRunningCommand,
} from "../pages/hands/workersClient";

describe("workersClient", () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it("setWorkersRunningCommand calls invoke(set_workers_running, ...)", async () => {
    invokeMock.mockResolvedValue("workers started");

    const out = await setWorkersRunningCommand({
      running: true,
      dbPath: "C:\\db\\poker_boss.db",
      outDir: "C:\\tmp\\workers_out",
      intervalMs: 3000,
    });

    expect(out).toBe("workers started");
    expect(invokeMock).toHaveBeenCalledTimes(1);
    expect(invokeMock).toHaveBeenCalledWith("set_workers_running", {
      running: true,
      dbPath: "C:\\db\\poker_boss.db",
      outDir: "C:\\tmp\\workers_out",
      intervalMs: 3000,
    });
  });

  it("runWorkersTickCommand calls invoke(run_workers_tick, ...)", async () => {
    invokeMock.mockResolvedValue("tick ok");

    const out = await runWorkersTickCommand({
      dbPath: "C:\\db\\poker_boss.db",
      outDir: "C:\\tmp\\workers_out",
      intervalMs: 3000,
      maxTicks: 1,
    });

    expect(out).toBe("tick ok");
    expect(invokeMock).toHaveBeenCalledTimes(1);
    expect(invokeMock).toHaveBeenCalledWith("run_workers_tick", {
      args: {
        dbPath: "C:\\db\\poker_boss.db",
        outDir: "C:\\tmp\\workers_out",
        intervalMs: 3000,
        maxTicks: 1,
      },
    });
  });

  it("getWorkersStatusState maps running=true from status text", async () => {
    invokeMock.mockResolvedValue("workers running | pid=123");

    const state = await getWorkersStatusState();

    expect(invokeMock).toHaveBeenCalledWith("get_workers_status");
    expect(state).toEqual({
      running: true,
      statusText: "workers running | pid=123",
    });
  });

  it("getWorkersStatusState maps running=false from status text", async () => {
    invokeMock.mockResolvedValue("stopped");

    const state = await getWorkersStatusState();

    expect(invokeMock).toHaveBeenCalledWith("get_workers_status");
    expect(state).toEqual({
      running: false,
      statusText: "stopped",
    });
  });

  it("getWorkersStatusState normalizes empty/null-ish status text", async () => {
    invokeMock.mockResolvedValue("");

    const state = await getWorkersStatusState();

    expect(state).toEqual({
      running: false,
      statusText: "",
    });
  });
});
