import { invoke } from "@tauri-apps/api/core";

import {
  BATCH_FOLDER_PATH,
  summarize,
} from "./handsPagePaths";

import { buildWorkersOutDir, getErrorMessage } from "./handsPageUtils";
import { runWorkersTickCommand, setWorkersRunningCommand } from "./workersClient";

type LoadOnceFn = () => Promise<void>;

type UseHandsPageWorkerActionsArgs = {
  safeDbPath: string;
  workersRunning: boolean;
  setWorkersRunning: (running: boolean) => void;
  setBusy: (v: boolean) => void;
  setActionStatus: (v: string) => void;
  setLastLog: (v: string) => void;
  loadObsOnce: LoadOnceFn;
};

export function useHandsPageWorkerActions({
  safeDbPath,
  workersRunning,
  setWorkersRunning,
  setBusy,
  setActionStatus,
  setLastLog,
  loadObsOnce,
}: UseHandsPageWorkerActionsArgs) {
  const onRunBatch = async () => {
    const p = safeDbPath;

    setBusy(true);
    setActionStatus("50 hands: running...");
    setLastLog("");

    try {
      const msg = await invoke<string>("run_worker_batch", {
        folderPath: BATCH_FOLDER_PATH,
        limit: 50,
        dbPath: p,
      });

      const m = String(msg || "");
      setLastLog(m);
      setActionStatus("50 hands: " + (summarize(m) || "ok"));
      await loadObsOnce();
    } catch (e: unknown) {
      const m = "ERROR: " + getErrorMessage(e);
      setLastLog(m);
      setActionStatus("50 hands: " + summarize(m));
    } finally {
      setBusy(false);
    }
  };

  const onRunOneForImage = async (imagePath: string): Promise<string> => {
    const p = safeDbPath;

    setBusy(true);
    setActionStatus("run one: running...");
    setLastLog("");

    try {
      const msg = await invoke<string>("run_worker_one", {
        imagePath,
        dbPath: p,
      });

      const m = String(msg || "");
      setLastLog(m);
      setActionStatus("run one: " + (summarize(m) || "ok"));
      await loadObsOnce();
      return m;
    } catch (e: unknown) {
      const m = "ERROR: " + getErrorMessage(e);
      setLastLog(m);
      setActionStatus("run one: " + summarize(m));
      return m;
    } finally {
      setBusy(false);
    }
  };

  const onToggleWorkers = async () => {
    const p = safeDbPath;
    const outDir = buildWorkersOutDir();
    const next = !workersRunning;

    setBusy(true);
    setActionStatus("workers: toggling...");
    setLastLog("");

    try {
      const msg = await setWorkersRunningCommand({
        running: next,
        dbPath: p,
        outDir,
        intervalMs: 3000,
      });

      const m = String(msg || "");
      setLastLog(m);
      setActionStatus("workers: " + (summarize(m) || "ok"));
      setWorkersRunning(next);
    } catch (e: unknown) {
      const m = "ERROR: " + getErrorMessage(e);
      setLastLog(m);
      setActionStatus("workers: " + summarize(m));
    } finally {
      setBusy(false);
    }
  };

  const onWorkersTick = async () => {
    const p = safeDbPath;
    const outDir = buildWorkersOutDir();

    setBusy(true);
    setActionStatus("workers tick: running...");
    setLastLog("");

    try {
      const msg = await runWorkersTickCommand({
        dbPath: p,
        outDir,
        intervalMs: 3000,
        maxTicks: 1,
      });

      const m = String(msg || "");
      setLastLog(m);
      setActionStatus("workers tick: " + (summarize(m) || "ok"));
    } catch (e: unknown) {
      const m = "ERROR: " + getErrorMessage(e);
      setLastLog(m);
      setActionStatus("workers tick: " + summarize(m));
    } finally {
      setBusy(false);
    }
  };

  return {
    onRunBatch,
    onRunOneForImage,
    onToggleWorkers,
    onWorkersTick,
  };
}
