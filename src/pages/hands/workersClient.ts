/// C:\Users\Usuario\Desktop\proyectos\poker_boss\src\pages\hands\workersClient.ts

import { invoke } from "@tauri-apps/api/core";
import { isWorkersRunningFromStatus } from "./handsPageUtils";

export type WorkersPollState = {
  running: boolean;
  statusText: string;
};

export const getWorkersStatusState = async (): Promise<WorkersPollState> => {
  const statusText = await invoke<string>("get_workers_status");
  return {
    running: isWorkersRunningFromStatus(statusText),
    statusText: String(statusText || ""),
  };
};

export const setWorkersRunningCommand = async (args: {
  running: boolean;
  dbPath: string;
  outDir: string;
  intervalMs: number;
}): Promise<string> => {
  return invoke<string>("set_workers_running", {
    running: args.running,
    dbPath: args.dbPath,
    outDir: args.outDir,
    intervalMs: args.intervalMs,
  });
};

export const runWorkersTickCommand = async (args: {
  dbPath: string;
  outDir: string;
  intervalMs: number;
  maxTicks: number;
}): Promise<string> => {
  return invoke<string>("run_workers_tick", {
    args: {
      dbPath: args.dbPath,
      outDir: args.outDir,
      intervalMs: args.intervalMs,
      maxTicks: args.maxTicks,
    },
  });
};
