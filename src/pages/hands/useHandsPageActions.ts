import { useHandsPageDataActions } from "./useHandsPageDataActions";
import { useHandsPageWorkerActions } from "./useHandsPageWorkerActions";

type LoadOnceFn = () => Promise<void>;

type UseHandsPageActionsArgs = {
  mode: "OBS" | "REAL";
  safeDbPath: string;
  workersRunning: boolean;
  setWorkersRunning: (running: boolean) => void;
  setBusy: (v: boolean) => void;
  setActionStatus: (v: string) => void;
  setLastLog: (v: string) => void;
  loadObsOnce: LoadOnceFn;
  loadRealOnce: LoadOnceFn;
  loadAllFourTables?: LoadOnceFn;
  clearWorkerProfile?: () => void;
};

export function useHandsPageActions({
  mode,
  safeDbPath,
  workersRunning,
  setWorkersRunning,
  setBusy,
  setActionStatus,
  setLastLog,
  loadObsOnce,
  loadRealOnce,
  loadAllFourTables,
  clearWorkerProfile,
}: UseHandsPageActionsArgs) {
  const dataActions = useHandsPageDataActions({
    mode,
    safeDbPath,
    setBusy,
    setActionStatus,
    setLastLog,
    loadObsOnce,
    loadRealOnce,
    loadAllFourTables,
    clearWorkerProfile,
  });

  const workerActions = useHandsPageWorkerActions({
    safeDbPath,
    workersRunning,
    setWorkersRunning,
    setBusy,
    setActionStatus,
    setLastLog,
    loadObsOnce,
  });

  return {
    ...dataActions,
    ...workerActions,
  };
}
