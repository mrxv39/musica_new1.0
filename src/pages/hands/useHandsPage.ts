import { useEffect, useMemo, useState } from "react";

import type { HandsMode } from "./HandsToolbar";
import type { HandsObsRow } from "../../db";

import { DEFAULT_DB_PATH } from "../../db";
import { useHandsObs } from "./useHandsObs";
import { useHandsReal } from "./useHandsReal";

import { sortHands } from "./sortHands";
import { useHandsSort } from "./useHandsSort";
import { filterHandsByAllFilters, parseNumericRange } from "./handsFilters";

import { summarize } from "./handsPagePaths";
import { ensureNonEmptyPath } from "./handsPageUtils";
import { useWorkersPolling } from "./useWorkersPolling";
import { useHandsPageActions } from "./useHandsPageActions";

export function useHandsPage() {
  const [mode, setMode] = useState<HandsMode>(() => {
    const saved = (localStorage.getItem("hands.mode") || "OBS").toUpperCase();
    return saved === "REAL" ? "REAL" : "OBS";
  });

  useEffect(() => {
    localStorage.setItem("hands.mode", mode);
  }, [mode]);

  const [dbPath, setDbPath] = useState<string>(() => localStorage.getItem("dbPath") || DEFAULT_DB_PATH);

  const [auto, setAuto] = useState<boolean>(() => (localStorage.getItem("autoRefresh") || "true") === "true");
  useEffect(() => {
    localStorage.setItem("autoRefresh", String(auto));
  }, [auto]);

  useEffect(() => {
    localStorage.setItem("dbPath", dbPath);
  }, [dbPath]);

  const obs = useHandsObs();
  useEffect(() => {
    obs.setDbPath(dbPath);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dbPath]);

  const real = useHandsReal(dbPath, auto);

  const [busy, setBusy] = useState<boolean>(false);
  const [actionStatus, setActionStatus] = useState<string>("");
  const [lastLog, setLastLog] = useState<string>("");

  const {
    workersRunning,
    setWorkersRunning,
    workersStatusText,
  } = useWorkersPolling(500);

  const { sortKey, sortAsc, onSort } = useHandsSort();

  const [stackEfRangeText, setStackEfRangeText] = useState<string>(
    () => localStorage.getItem("hands.stackEfRangeText") || ""
  );
  const [betRangeText, setBetRangeText] = useState<string>(
    () => localStorage.getItem("hands.betRangeText") || ""
  );
  const [rangeListText, setRangeListText] = useState<string>(
    () => localStorage.getItem("hands.rangeListText") || ""
  );

  useEffect(() => {
    localStorage.setItem("hands.stackEfRangeText", stackEfRangeText);
  }, [stackEfRangeText]);

  useEffect(() => {
    localStorage.setItem("hands.betRangeText", betRangeText);
  }, [betRangeText]);

  useEffect(() => {
    localStorage.setItem("hands.rangeListText", rangeListText);
  }, [rangeListText]);

  const stackEfRange = useMemo(() => parseNumericRange(stackEfRangeText), [stackEfRangeText]);
  const betRange = useMemo(() => parseNumericRange(betRangeText), [betRangeText]);

  const filtered = useMemo(
    () => filterHandsByAllFilters(obs.rows as HandsObsRow[], stackEfRange, betRange, rangeListText),
    [obs.rows, stackEfRange, betRange, rangeListText]
  );

  const sortedObsRows = useMemo(
    () => sortHands(filtered.rows, sortKey, sortAsc),
    [filtered.rows, sortKey, sortAsc]
  );

  const sortedRealRows = useMemo(() => real.rows, [real.rows]);

  const canLoad = useMemo(() => dbPath.trim().length > 0, [dbPath]);

  const uiStatus = useMemo(() => {
    if (busy && actionStatus) return actionStatus;
    if (workersRunning && workersStatusText) return workersStatusText;
    if (mode === "REAL") return real.status;
    return obs.status;
  }, [busy, actionStatus, workersRunning, workersStatusText, mode, real.status, obs.status]);

  const safeDbPath = useMemo(() => ensureNonEmptyPath(dbPath, DEFAULT_DB_PATH), [dbPath]);

  const loadOnce = async () => {
    if (mode === "REAL") {
      await real.loadOnce();
    } else {
      await obs.loadOnce();
    }
  };

  const onClearFilters = () => {
    setStackEfRangeText("");
    setBetRangeText("");
    setRangeListText("");
    localStorage.removeItem("hands.stackEfRangeText");
    localStorage.removeItem("hands.betRangeText");
    localStorage.removeItem("hands.rangeListText");
  };

  const obsFooterText = useMemo(() => {
    return filtered.rangeError ? String(filtered.rangeError) : "";
  }, [filtered.rangeError]);

  const {
    onReset,
    onRunBatch,
    onRunOneForImage,
    onToggleWorkers,
    onImportXml,
    onWorkersTick,
  } = useHandsPageActions({
    mode,
    safeDbPath,
    workersRunning,
    setWorkersRunning,
    setBusy,
    setActionStatus,
    setLastLog,
    loadObsOnce: obs.loadOnce,
    loadRealOnce: real.loadOnce,
  });

  return {
    mode,
    setMode,
    dbPath,
    setDbPath,
    auto,
    setAuto,
    canLoad,
    uiStatus,
    busy,
    actionStatus,
    lastLog,
    workersRunning,
    onToggleWorkers,
    sortKey,
    sortAsc,
    onSort,
    stackEfRangeText,
    setStackEfRangeText,
    betRangeText,
    setBetRangeText,
    rangeListText,
    setRangeListText,
    onClearFilters,
    obsFooterText,
    sortedObsRows,
    sortedRealRows,
    loadOnce,
    onReset,
    onRunBatch,
    onRunOneForImage,
    onImportXml,
    onWorkersTick,
  };
}
