/// C:\Users\Usuario\Desktop\proyectos\poker_boss\src\pages\HandsPage.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import HandsToolbar from "./hands/HandsToolbar";
import HandsTable from "./hands/HandsTable";
import { useHandsObs } from "./hands/useHandsObs";
import { sortHands } from "./hands/sortHands";
import { useHandsSort } from "./hands/useHandsSort";
import { filterHandsByAllFilters, parseNumericRange } from "./hands/handsFilters";

const BATCH_FOLDER_PATH =
  "C:\\Users\\Usuario\\Desktop\\proyectos\\poker_boss\\modules\\preflop\\test_images";

function summarize(s: string, max = 220) {
  const t = (s || "").replace(/\s+/g, " ").trim();
  if (!t) return "";
  return t.length > max ? t.slice(0, max) + " …" : t;
}

export default function HandsPage() {
  const { dbPath, setDbPath, rows, status, auto, setAuto, canLoad, loadOnce } = useHandsObs();
  const { sortKey, sortAsc, onSort } = useHandsSort();

  const [busy, setBusy] = useState<boolean>(false);
  const [actionStatus, setActionStatus] = useState<string>("");
  const [lastLog, setLastLog] = useState<string>("");

  const [workersRunning, setWorkersRunning] = useState<boolean>(false);
  const pollRef = useRef<number | null>(null);

  const [stackEfRangeText, setStackEfRangeText] = useState<string>(
    () => localStorage.getItem("hands.stackEfRangeText") || ""
  );
  const [betRangeText, setBetRangeText] = useState<string>(
    () => localStorage.getItem("hands.betRangeText") || ""
  );
  const [rangeListText, setRangeListText] = useState<string>(
    () => localStorage.getItem("hands.rangeListText") || ""
  );

  const stackEfRange = useMemo(() => parseNumericRange(stackEfRangeText), [stackEfRangeText]);
  const betRange = useMemo(() => parseNumericRange(betRangeText), [betRangeText]);

  const filtered = useMemo(
    () => filterHandsByAllFilters(rows, stackEfRange, betRange, rangeListText),
    [rows, stackEfRange, betRange, rangeListText]
  );

  const sortedRows = useMemo(
    () => sortHands(filtered.rows, sortKey, sortAsc),
    [filtered.rows, sortKey, sortAsc]
  );

  useEffect(() => {
    // polling status while workers running (UI feedback)
    if (workersRunning) {
      if (pollRef.current == null) {
        pollRef.current = window.setInterval(async () => {
          try {
            const s = await invoke<string>("get_workers_status");
            if (s) setLastLog(String(s));
          } catch {
            // ignore
          }
        }, 700);
      }
    } else {
      if (pollRef.current != null) {
        window.clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }
    return () => {};
  }, [workersRunning]);

  const onReset = async () => {
    const p = dbPath.trim();
    if (!p) return;

    setBusy(true);
    setActionStatus("reset: running...");
    setLastLog("");
    try {
      const msg = await invoke<string>("reset_hands_obs", { dbPath: p });
      const m = String(msg || "");
      setLastLog(m);
      setActionStatus("reset: " + (summarize(m) || "ok"));
      await loadOnce();
    } catch (e: any) {
      const m = "ERROR: " + (e?.message || String(e));
      setLastLog(m);
      setActionStatus("reset: " + summarize(m));
    } finally {
      setBusy(false);
    }
  };

  const onRunBatch = async () => {
    const p = dbPath.trim();
    if (!p) return;

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
      await loadOnce();
    } catch (e: any) {
      const m = "ERROR: " + (e?.message || String(e));
      setLastLog(m);
      setActionStatus("50 hands: " + summarize(m));
    } finally {
      setBusy(false);
    }
  };

  // Esto lo usa el modal (run one por imagen abierta)
  const onRunOneForImage = async (imagePath: string) => {
    const p = dbPath.trim();
    const img = (imagePath || "").trim();

    if (!p) return "ERROR: dbPath vacío";
    if (!img) return "ERROR: imagePath vacío";

    try {
      const msg = await invoke<string>("run_worker_one", { imagePath: img, dbPath: p });
      const m = String(msg || "");
      await loadOnce();
      return m.trim();
    } catch (e: any) {
      return "ERROR: " + (e?.message || String(e));
    }
  };

  const onToggleWorkers = async () => {
    const p = dbPath.trim();
    if (!p) return;

    const next = !workersRunning;
    setWorkersRunning(next);
    setActionStatus(next ? "workers: starting..." : "workers: stopping...");

    try {
      const msg = await invoke<string>("set_workers_running", {
        running: next,
        dbPath: p,
        outDir: BATCH_FOLDER_PATH,
        intervalMs: 800,
      });
      setLastLog(String(msg || ""));
      setActionStatus("workers: " + (next ? "running" : "stopped"));
      await loadOnce();
    } catch (e: any) {
      const m = "ERROR: " + (e?.message || String(e));
      setLastLog(m);
      setActionStatus("workers: " + summarize(m));
      setWorkersRunning(false);
    }
  };

  const uiStatus =
    actionStatus && actionStatus.trim().length > 0 ? `${status} | ${actionStatus}` : status;

  const onChangeStackEfRangeText = (v: string) => {
    setStackEfRangeText(v);
    localStorage.setItem("hands.stackEfRangeText", v);
  };

  const onChangeBetRangeText = (v: string) => {
    setBetRangeText(v);
    localStorage.setItem("hands.betRangeText", v);
  };

  const onChangeRangeListText = (v: string) => {
    setRangeListText(v);
    localStorage.setItem("hands.rangeListText", v);
  };

  const onClearFilters = () => {
    onChangeStackEfRangeText("");
    onChangeBetRangeText("");
    onChangeRangeListText("");
  };

  return (
    <>
      <HandsToolbar
        dbPath={dbPath}
        onChangeDbPath={setDbPath}
        canLoad={canLoad}
        onRefresh={loadOnce}
        auto={auto}
        onToggleAuto={setAuto}
        status={uiStatus}
        busy={busy}
        onReset={onReset}
        onRunBatch={onRunBatch}
        workersRunning={workersRunning}
        onToggleWorkers={onToggleWorkers}
        stackEfRangeText={stackEfRangeText}
        onChangeStackEfRangeText={onChangeStackEfRangeText}
        betRangeText={betRangeText}
        onChangeBetRangeText={onChangeBetRangeText}
        rangeListText={rangeListText}
        onChangeRangeListText={onChangeRangeListText}
        onClearFilters={onClearFilters}
      />

      <div style={{ height: 10 }} />

      <HandsTable
        rows={sortedRows}
        sortKey={sortKey}
        sortAsc={sortAsc}
        onSort={onSort}
        canRunOne={Boolean(canLoad && dbPath.trim().length > 0)}
        onRunOneForImage={onRunOneForImage}
        lastLog={lastLog}
        dbPath={dbPath.trim()}
        totalRows={rows.length}
        shownRows={sortedRows.length}
        rangeError={filtered.rangeError || ""}
        batchFolderPath={BATCH_FOLDER_PATH}
      />
    </>
  );
}