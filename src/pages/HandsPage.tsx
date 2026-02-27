/// C:\Users\Usuario\Desktop\proyectos\poker_boss\src\pages\HandsPage.tsx
import { useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import HandsToolbar from "./hands/HandsToolbar";
import HandsTable from "./hands/HandsTable";
import { useHandsObs } from "./hands/useHandsObs";
import { sortHands } from "./hands/sortHands";
import { useHandsSort } from "./hands/useHandsSort";

const ONE_IMAGE_PATH =
  "C:\\Users\\Usuario\\Desktop\\proyectos\\poker_boss\\modules\\preflop\\test_images\\screenshot_20260126071702980.bmp";

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

  const sortedRows = useMemo(() => sortHands(rows, sortKey, sortAsc), [rows, sortKey, sortAsc]);

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

  const onRunOne = async () => {
    const p = dbPath.trim();
    if (!p) return;

    setBusy(true);
    setActionStatus("1 hand: running...");
    setLastLog("");
    try {
      const msg = await invoke<string>("run_worker_one", { imagePath: ONE_IMAGE_PATH, dbPath: p });
      const m = String(msg || "");
      setLastLog(m);
      setActionStatus("1 hand: " + (summarize(m) || "ok"));
      await loadOnce();
    } catch (e: any) {
      const m = "ERROR: " + (e?.message || String(e));
      setLastLog(m);
      setActionStatus("1 hand: " + summarize(m));
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

  const uiStatus =
    actionStatus && actionStatus.trim().length > 0 ? `${status} | ${actionStatus}` : status;

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
        onRunOne={onRunOne}
        onRunBatch={onRunBatch}
      />

      <HandsTable rows={sortedRows} onSort={onSort} />

      <div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>
        DB actual: {dbPath.trim()}
      </div>

      <div style={{ marginTop: 6, fontSize: 12, opacity: 0.7 }}>
        Img 1-hand: {ONE_IMAGE_PATH}
      </div>
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
