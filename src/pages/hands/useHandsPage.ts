import { useEffect, useMemo, useRef, useState } from "react";

import type { HandsMode } from "./HandsToolbar";
import type { HandsObsRow, TournamentRow, SpotRow, WorkerProfileRow } from "../../db";
import { fetchTournaments, fetchSpots, fetchWorkerProfileSummary } from "../../db";
import { listPlayers, type PlayerRow } from "../../db/players";

import { getHandsDefaultDbPath } from "../../config";
import { useHandsObs } from "./useHandsObs";
import { useHandsReal } from "./useHandsReal";

import { sortHands } from "./sortHands";
import { useHandsSort } from "./useHandsSort";
import { filterHandsByAllFilters, parseNumericRange } from "./handsFilters";
import type { LinkFilter } from "./handsFilters";

import { useWorkersPolling } from "./useWorkersPolling";
import { useHandsPageActions } from "./useHandsPageActions";

type MesaOverlayState = {
  mesa: number;
  table_id: string;
  last_detected_at_ms: number | null;
  preflop_ok: boolean;
  frame_ref: string | null;
};

function canUseTauriInvoke() {
  try {
    return typeof window !== "undefined" && !!(window as any).__TAURI_INTERNALS__?.invoke;
  } catch {
    return false;
  }
}

export function useHandsPage() {
  const [mode, setMode] = useState<HandsMode>(() => {
    const saved = (localStorage.getItem("hands.mode") || "OBS").toUpperCase();
    return saved === "REAL" ? "REAL" : "OBS";
  });

  useEffect(() => {
    localStorage.setItem("hands.mode", mode);
  }, [mode]);

  const dbPath = getHandsDefaultDbPath();
  const setDbPath = () => {}; // no-op: DB fija por config, sin input en UI

  const [auto, setAuto] = useState<boolean>(() => (localStorage.getItem("autoRefresh") || "true") === "true");
  useEffect(() => {
    localStorage.setItem("autoRefresh", String(auto));
  }, [auto]);

  const obs = useHandsObs();
  useEffect(() => {
    obs.setDbPath(dbPath);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const real = useHandsReal(dbPath, auto);

  const [tournaments, setTournaments] = useState<TournamentRow[]>([]);
  const [spotsReal, setSpotsReal] = useState<SpotRow[]>([]);
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [workerProfile, setWorkerProfile] = useState<WorkerProfileRow[]>([]);

  const [busy, setBusy] = useState<boolean>(false);
  const [actionStatus, setActionStatus] = useState<string>("");
  const [lastLog, setLastLog] = useState<string>("");
  const [mesaOverlay, setMesaOverlay] = useState<MesaOverlayState[]>([]);

  const {
    workersRunning,
    setWorkersRunning,
    workersStatusText,
  } = useWorkersPolling(500);

  useEffect(() => {
    if (!workersRunning) return;
    if (!canUseTauriInvoke()) return;

    let cancelled = false;

    const tick = async () => {
      try {
        const { invoke } = await import("@tauri-apps/api/core");

        if (!canUseTauriInvoke()) return;

        const rows = await invoke<MesaOverlayState[]>(
          "get_mesas_overlay_state",
          { dbPath }
        );

        if (!cancelled) {
          setMesaOverlay(Array.isArray(rows) ? rows : []);
        }
      } catch (err) {
        console.error("overlay_state failed", err);
      }
    };

    tick();
    const id = setInterval(tick, 1000);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [workersRunning, dbPath]);

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
  const [linkFilter, setLinkFilter] = useState<LinkFilter>(() => {
    const saved = localStorage.getItem("hands.linkFilter");
    return saved === "linked" || saved === "unlinked" ? saved : "all";
  });

  useEffect(() => {
    localStorage.setItem("hands.stackEfRangeText", stackEfRangeText);
  }, [stackEfRangeText]);

  useEffect(() => {
    localStorage.setItem("hands.betRangeText", betRangeText);
  }, [betRangeText]);

  useEffect(() => {
    localStorage.setItem("hands.rangeListText", rangeListText);
  }, [rangeListText]);

  useEffect(() => {
    localStorage.setItem("hands.linkFilter", linkFilter);
  }, [linkFilter]);

  const stackEfRange = useMemo(() => parseNumericRange(stackEfRangeText), [stackEfRangeText]);
  const betRange = useMemo(() => parseNumericRange(betRangeText), [betRangeText]);

  const filtered = useMemo(
    () => filterHandsByAllFilters(obs.rows as HandsObsRow[], stackEfRange, betRange, rangeListText, linkFilter),
    [obs.rows, stackEfRange, betRange, rangeListText, linkFilter]
  );

  const sortedObsRows = useMemo(
    () => sortHands(filtered.rows, sortKey, sortAsc),
    [filtered.rows, sortKey, sortAsc]
  );

  const sortedRealRows = useMemo(() => real.rows, [real.rows]);

  const canLoad = true;

  const uiStatus = useMemo(() => {
    if (busy && actionStatus) return actionStatus;
    if (workersRunning && workersStatusText) return workersStatusText;
    if (mode === "REAL") return real.status;
    return obs.status;
  }, [busy, actionStatus, workersRunning, workersStatusText, mode, real.status, obs.status]);

  const safeDbPath = dbPath;

  const loadTournamentsOnce = async () => {
    try {
      const rows = await fetchTournaments(dbPath);
      setTournaments(rows);
    } catch (e) {
      console.error("load tournaments failed", e);
      setTournaments([]);
    }
  };

  const loadSpotsRealOnce = async () => {
    try {
      const rows = await fetchSpots(dbPath);
      setSpotsReal(rows);
    } catch (e) {
      console.error("load spots failed", e);
      setSpotsReal([]);
    }
  };

  const loadWorkerProfileOnce = async () => {
    try {
      const rows = await fetchWorkerProfileSummary(dbPath);
      setWorkerProfile(rows);
    } catch (e) {
      console.error("load worker_profile failed", e);
      setWorkerProfile([]);
    }
  };

  const loadPlayersOnce = async () => {
    try {
      const rows = await listPlayers();
      setPlayers(rows);
    } catch (e) {
      console.error("load players failed", e);
      setPlayers([]);
    }
  };

  const loadAllFourTables = async () => {
    await Promise.all([
      loadTournamentsOnce(),
      mode === "REAL" ? real.loadOnce() : obs.loadOnce(),
      loadSpotsRealOnce(),
      loadPlayersOnce(),
      loadWorkerProfileOnce(),
    ]);
  };

  const loadOnce = async () => {
    if (mode === "REAL") {
      await real.loadOnce();
    } else {
      await obs.loadOnce();
    }
  };

  useEffect(() => {
    loadTournamentsOnce();
    loadSpotsRealOnce();
    loadPlayersOnce();
    loadWorkerProfileOnce();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dbPath]);

  const prevWorkersRunningRef = useRef<boolean>(false);
  const loadAllFourTablesRef = useRef(loadAllFourTables);
  loadAllFourTablesRef.current = loadAllFourTables;
  useEffect(() => {
    const wasRunning = prevWorkersRunningRef.current;
    prevWorkersRunningRef.current = workersRunning;
    if (wasRunning && !workersRunning) {
      loadAllFourTablesRef.current();
    }
  }, [workersRunning]);

  const onClearFilters = () => {
    setStackEfRangeText("");
    setBetRangeText("");
    setRangeListText("");
    setLinkFilter("all");
    localStorage.removeItem("hands.stackEfRangeText");
    localStorage.removeItem("hands.betRangeText");
    localStorage.removeItem("hands.rangeListText");
    localStorage.removeItem("hands.linkFilter");
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
    loadAllFourTables,
    clearWorkerProfile: () => setWorkerProfile([]),
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
    mesaOverlay,
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
    linkFilter,
    setLinkFilter,
    onClearFilters,
    obsFooterText,
    sortedObsRows,
    sortedRealRows,
    tournaments,
    spotsReal,
    players,
    workerProfile,
    loadOnce,
    loadAllFourTables,
    onReset,
    onRunBatch,
    onRunOneForImage,
    onImportXml,
    onWorkersTick,
  };
}
