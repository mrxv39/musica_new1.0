/// C:\Users\Usuario\Desktop\proyectos\poker_boss\src\pages\HandsPage.tsx
import { useMemo, useState } from "react";
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

  // ✅ esto es lo que usa el modal (dinámico, por imagen abierta)
  const onRunOneForImage = async (imagePath: string) => {
    const p = dbPath.trim();
    const img = (imagePath || "").trim();

    if (!p) return "ERROR: dbPath vacío";
    if (!img) return "ERROR: imagePath vacío";

    try {
      // IMPORTANTE: la key tiene que llamarse imagePath (mismo nombre que te pide el error)
      const msg = await invoke<string>("run_worker_one", { imagePath: img, dbPath: p });
      const m = String(msg || "");
      await loadOnce();
      return m.trim();
    } catch (e: any) {
      return "ERROR: " + (e?.message || String(e));
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
        stackEfRangeText={stackEfRangeText}
        onChangeStackEfRangeText={onChangeStackEfRangeText}
        betRangeText={betRangeText}
        onChangeBetRangeText={onChangeBetRangeText}
        rangeListText={rangeListText}
        onChangeRangeListText={onChangeRangeListText}
        onClearFilters={onClearFilters}
      />

      <HandsTable
        rows={sortedRows}
        onSort={onSort}
        canRunOne={Boolean(canLoad && dbPath.trim().length > 0)}
        onRunOneForImage={onRunOneForImage}
      />

      <div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>
        Rows: {sortedRows.length} / {rows.length} | DB actual: {dbPath.trim()}
      </div>

      {filtered.rangeError ? (
        <div style={{ marginTop: 6, fontSize: 12, color: "#b00020" }}>
          Rango inválido: {filtered.rangeError}
        </div>
      ) : null}

      <div style={{ marginTop: 2, fontSize: 12, opacity: 0.7 }}>
        Folder 50-hands: {BATCH_FOLDER_PATH}
      </div>

      {lastLog ? (
        <details style={{ marginTop: 10 }}>
          <summary style={{ cursor: "pointer", fontSize: 12, opacity: 0.8 }}>
            Ver log completo (stdout/stderr)
          </summary>
          <pre style={{ whiteSpace: "pre-wrap", fontSize: 12, marginTop: 8 }}>{lastLog}</pre>
        </details>
      ) : null}
    </>
  );
}
