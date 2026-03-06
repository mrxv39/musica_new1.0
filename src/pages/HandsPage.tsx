// C:\Users\Usuario\Desktop\proyectos\poker_boss\src\pages\HandsPage.tsx
import { invoke } from "@tauri-apps/api/core";
import HandsToolbar from "./hands/HandsToolbar";
import HandsTable from "./hands/HandsTable";
import RealHandsTable from "./hands/RealHandsTable";

import { useHandsPage } from "./hands/useHandsPage";
import { CHAMPION_XML_DIR, XML_ARCHIVE_DIR } from "./hands/handsPagePaths";

const ensureDbPath = (p: string | undefined | null) => {
  if (!p || p.trim() === "") {
    return "poker_boss.db";
  }
  return p;
};

export default function HandsPage() {
  const hp = useHandsPage();

  const canRunOne = hp.mode === "OBS" && hp.canLoad && !hp.busy;

  const runMatchImages = async () => {
    const spotsDir =
      "C:\\Users\\Usuario\\Desktop\\proyectos\\poker_boss\\data\\spots_raw\\time_spots\\20260305";

    try {
      const res = await invoke<string>("match_spots", {
        dbPath: ensureDbPath(hp.dbPath),
        spotsDir,
        windowMs: 60000,
      });

      console.log(res);
      alert(String(res || "Match Images OK"));

      await hp.loadOnce();
    } catch (e: any) {
      console.error(e);
      alert(String(e?.message || e || "Match Images error"));
    }
  };

  return (
    <div style={{ padding: 16 }}>
      <HandsToolbar
        mode={hp.mode}
        onChangeMode={hp.setMode}
        dbPath={hp.dbPath}
        onChangeDbPath={hp.setDbPath}
        canLoad={hp.canLoad}
        onRefresh={hp.loadOnce}
        auto={hp.auto}
        onToggleAuto={hp.setAuto}
        status={hp.uiStatus}
        busy={hp.busy}
        onReset={hp.onReset}
        onRunBatch={hp.onRunBatch}
        workersRunning={hp.workersRunning}
        onToggleWorkers={hp.onToggleWorkers}
        stackEfRangeText={hp.stackEfRangeText}
        onChangeStackEfRangeText={hp.setStackEfRangeText}
        betRangeText={hp.betRangeText}
        onChangeBetRangeText={hp.setBetRangeText}
        rangeListText={hp.rangeListText}
        onChangeRangeListText={hp.setRangeListText}
        onClearFilters={hp.onClearFilters}
      />

      <div style={{ height: 10 }} />

      {hp.mode === "REAL" ? (
        <>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <button disabled={!hp.canLoad} onClick={hp.onToggleWorkers}>
              {hp.workersRunning ? "Stop workers" : "Run workers (loop)"}
            </button>

            <button disabled={!hp.canLoad || hp.busy} onClick={hp.onImportXml}>
              Import XML
            </button>

            <button disabled={!hp.canLoad || hp.busy} onClick={runMatchImages}>
              Match Images
            </button>

            <span style={{ fontSize: 12, opacity: 0.75 }}>
              xml: {CHAMPION_XML_DIR} | archive: {XML_ARCHIVE_DIR}
            </span>
          </div>

          <div style={{ height: 10 }} />

          <RealHandsTable rows={hp.sortedRealRows} dbPath={hp.dbPath} />
        </>
      ) : (
        <>
          <HandsTable
            rows={hp.sortedObsRows}
            onSort={hp.onSort}
            sortKey={hp.sortKey}
            sortAsc={hp.sortAsc}
            canRunOne={canRunOne}
            onRunOneForImage={hp.onRunOneForImage}
            lastLog={hp.lastLog}
            dbPath={hp.dbPath}
          />

          {hp.obsFooterText ? (
            <div style={{ marginTop: 10, fontSize: 12, opacity: 0.8 }}>{hp.obsFooterText}</div>
          ) : null}
        </>
      )}

      <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
        {hp.actionStatus ? <div>{hp.actionStatus}</div> : null}
        {hp.lastLog ? <pre style={{ whiteSpace: "pre-wrap" }}>{hp.lastLog}</pre> : null}
      </div>
    </div>
  );
}