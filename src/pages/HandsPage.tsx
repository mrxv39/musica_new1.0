/// C:\Users\Usuario\Desktop\proyectos\poker_boss\src\pages\HandsPage.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import HandsToolbar, { HandsMode } from "./hands/HandsToolbar";
import HandsTable from "./hands/HandsTable";
import RealHandsTable from "./hands/RealHandsTable";

import { DEFAULT_DB_PATH, HandsObsRow } from "../db";
import { useHandsObs } from "./hands/useHandsObs";
import { useHandsReal } from "./hands/useHandsReal";

import { sortHands } from "./hands/sortHands";
import { useHandsSort } from "./hands/useHandsSort";
import { filterHandsByAllFilters, parseNumericRange } from "./hands/handsFilters";

const BATCH_FOLDER_PATH =
  "C:\\Users\\Usuario\\Desktop\\proyectos\\poker_boss\\modules\\preflop\\test_images";

// === REAL (XML import) paths (ajusta si cambia el usuario/carpeta) ===
const PROJECT_ROOT = "C:\\Users\\Usuario\\Desktop\\proyectos\\poker_boss";
const CHAMPION_XML_DIR =
  "C:\\Users\\Usuario\\Desktop\\Nueva carpeta\\ChampionPoker\\Championpoker\\data\\xavieeee2\\History\\Data\\Tournaments";
const XML_ARCHIVE_DIR = `${PROJECT_ROOT}\\data\\xml_imported`;
const SPOTS_OUT_BASE = `${PROJECT_ROOT}\\data\\spots_raw\\time_spots`;

// ✅ HERO fijo para Champion
const CHAMPION_HERO = "xavieeee2";

function summarize(s: string, max = 220) {
  const t = (s || "").replace(/\s+/g, " ").trim();
  if (!t) return "";
  return t.length > max ? t.slice(0, max) + " …" : t;
}

function yyyymmdd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

export default function HandsPage() {
  // ===== Mode (OBS vs REAL) =====
  const [mode, setMode] = useState<HandsMode>(() => {
    const saved = (localStorage.getItem("hands.mode") || "OBS").toUpperCase();
    return saved === "REAL" ? "REAL" : "OBS";
  });

  useEffect(() => {
    localStorage.setItem("hands.mode", mode);
  }, [mode]);

  // ===== DB path (shared) =====
  const [dbPath, setDbPath] = useState<string>(() => localStorage.getItem("dbPath") || DEFAULT_DB_PATH);

  // ===== Auto refresh (shared) =====
  const [auto, setAuto] = useState<boolean>(() => (localStorage.getItem("autoRefresh") || "true") === "true");
  useEffect(() => {
    localStorage.setItem("autoRefresh", String(auto));
  }, [auto]);

  // Keep existing OBS hook (we only use it for loading hands_obs)
  const obs = useHandsObs();
  useEffect(() => {
    // keep hooks consistent: drive useHandsObs dbPath from this page
    obs.setDbPath(dbPath);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dbPath]);

  // REAL hook
  const real = useHandsReal(dbPath, auto);

  // ===== OBS filtering/sorting =====
  const { sortKey, sortAsc, onSort } = useHandsSort();

  const [busy, setBusy] = useState<boolean>(false);
  const [actionStatus, setActionStatus] = useState<string>("");
  const [lastLog, setLastLog] = useState<string>("");

  const [workersRunning, setWorkersRunning] = useState<boolean>(false);
  const pollRef = useRef<number | null>(null);

  const [stackEfRangeText, setStackEfRangeText] = useState<string>(() => localStorage.getItem("hands.stackEfRangeText") || "");
  const [betRangeText, setBetRangeText] = useState<string>(() => localStorage.getItem("hands.betRangeText") || "");
  const [rangeListText, setRangeListText] = useState<string>(() => localStorage.getItem("hands.rangeListText") || "");

  const stackEfRange = useMemo(() => parseNumericRange(stackEfRangeText), [stackEfRangeText]);
  const betRange = useMemo(() => parseNumericRange(betRangeText), [betRangeText]);

  const filtered = useMemo(
    () => filterHandsByAllFilters(obs.rows as HandsObsRow[], stackEfRange, betRange, rangeListText),
    [obs.rows, stackEfRange, betRange, rangeListText]
  );

  const sortedObsRows = useMemo(() => sortHands(filtered.rows, sortKey, sortAsc), [filtered.rows, sortKey, sortAsc]);

  // REAL sorted (simple)
  const sortedRealRows = useMemo(() => {
    const xs = [...real.rows];
    xs.sort((a, b) => {
      const ad = (a.startdate || "").localeCompare(b.startdate || "");
      if (ad !== 0) return -ad;
      return (b.id ?? 0) - (a.id ?? 0);
    });
    return xs;
  }, [real.rows]);

  // workers status polling (UI feedback)
  useEffect(() => {
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

  const canLoad = dbPath.trim().length > 0;

  const loadOnce = async () => {
    if (mode === "REAL") {
      await real.loadOnce();
    } else {
      await obs.loadOnce();
    }
  };

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
      await obs.loadOnce();
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
      await obs.loadOnce();
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
      await obs.loadOnce();
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
      await obs.loadOnce();
    } catch (e: any) {
      const m = "ERROR: " + (e?.message || String(e));
      setLastLog(m);
      setActionStatus("workers: " + summarize(m));
      setWorkersRunning(false);
    }
  };

  // ===== NUEVO: (REAL) Run workers 1 tick =====
  const onRunWorkersTickReal = async () => {
    const p = dbPath.trim();
    if (!p) return;

    const outDir = `${SPOTS_OUT_BASE}\\${yyyymmdd(new Date())}`;

    setBusy(true);
    setActionStatus("workers(1 tick): running...");
    setLastLog("");
    try {
      const msg = await invoke<string>("run_workers_tick", {
        dbPath: p,
        outDir,
        intervalMs: 200,
        maxTicks: 1,
      });
      const m = String(msg || "");
      setLastLog(m);
      setActionStatus("workers(1 tick): " + (summarize(m) || "ok"));
      await real.loadOnce();
    } catch (e: any) {
      const m = "ERROR: " + (e?.message || String(e));
      setLastLog(m);
      setActionStatus("workers(1 tick): " + summarize(m));
    } finally {
      setBusy(false);
    }
  };

  // ===== NUEVO: (REAL) Import XML =====
  const onImportXmlReal = async () => {
    const p = dbPath.trim();
    if (!p) return;

    setBusy(true);
    setActionStatus("import xml: running...");
    setLastLog("");
    try {
      const msg = await invoke<string>("import_champion_xml", {
        dbPath: p,
        xmlDir: CHAMPION_XML_DIR,
        archiveDir: XML_ARCHIVE_DIR,
        hero: CHAMPION_HERO, // ✅ IMPORTANT
      });
      const m = String(msg || "");
      setLastLog(m);
      setActionStatus("import xml: " + (summarize(m) || "ok"));
      await real.loadOnce();
    } catch (e: any) {
      const m = "ERROR: " + (e?.message || String(e));
      setLastLog(m);
      setActionStatus("import xml: " + summarize(m));
    } finally {
      setBusy(false);
    }
  };

  const uiStatusBase = mode === "REAL" ? real.status : obs.status;
  const uiStatus = actionStatus && actionStatus.trim().length > 0 ? `${uiStatusBase} | ${actionStatus}` : uiStatusBase;

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
        mode={mode}
        onChangeMode={setMode}
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

      {/* === NUEVO: Botones SOLO en modo REAL, sin tocar HandsToolbar.tsx === */}
      {mode === "REAL" ? (
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 8, flexWrap: "wrap" }}>
          <button disabled={!canLoad || busy} onClick={onRunWorkersTickReal} title="Captura 4 mesas (1 tick)">
            Run workers (1 tick)
          </button>

          <button disabled={!canLoad || busy} onClick={onImportXmlReal} title="Importa XML y mueve a data/xml_imported">
            Import XML
          </button>

          <span style={{ fontSize: 12, opacity: 0.75 }}>
            xml: {CHAMPION_XML_DIR} | archive: {XML_ARCHIVE_DIR}
          </span>
        </div>
      ) : null}

      <div style={{ height: 10 }} />

      {mode === "REAL" ? (
        <RealHandsTable rows={sortedRealRows} dbPath={dbPath.trim()} />
      ) : (
        <HandsTable
          rows={sortedObsRows}
          sortKey={sortKey}
          sortAsc={sortAsc}
          onSort={onSort}
          canRunOne={Boolean(canLoad && dbPath.trim().length > 0)}
          onRunOneForImage={onRunOneForImage}
          lastLog={lastLog}
          dbPath={dbPath.trim()}
          totalRows={obs.rows.length}
          shownRows={sortedObsRows.length}
          rangeError={filtered.rangeError || ""}
          batchFolderPath={BATCH_FOLDER_PATH}
        />
      )}
    </>
  );
}