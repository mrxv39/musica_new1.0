// C:\Users\Usuario\Desktop\proyectos\poker_boss\src\pages\HandsPage.tsx
import { invoke } from "@tauri-apps/api/core";
import HandsToolbar from "./hands/HandsToolbar";
import {
  TournamentsTable,
  HandsTableBlock,
  SpotsRealTable,
  PlayersTableBlock,
  WorkerProfileTableBlock,
} from "./hands/HandsFourTables";

import { useHandsPage } from "./hands/useHandsPage";
import { CHAMPION_XML_DIR, XML_ARCHIVE_DIR } from "./hands/handsPagePaths";

const canUseTauriInvoke = () => {
  try {
    return typeof window !== "undefined" && !!(window as any).__TAURI_INTERNALS__;
  } catch {
    return false;
  }
};

export default function HandsPage() {
  const hp = useHandsPage();

  const canRunOne = hp.mode === "OBS" && hp.canLoad && !hp.busy;

  const handleToggleWorkers = async () => {
    const shouldStart = !hp.workersRunning;

    await Promise.resolve(hp.onToggleWorkers());

    if (!canUseTauriInvoke()) {
      return;
    }

    try {
      if (shouldStart) {
        await invoke("show_overlay");
      } else {
        await invoke("hide_overlay");
      }
    } catch (e) {
      console.error("overlay toggle failed", e);
    }
  };

  return (
    <div style={{ padding: 16 }}>
      <HandsToolbar
        mode={hp.mode}
        onChangeMode={hp.setMode}
        canLoad={hp.canLoad}
        onRefresh={hp.loadOnce}
        auto={hp.auto}
        onToggleAuto={hp.setAuto}
        status={hp.uiStatus}
        busy={hp.busy}
        onReset={hp.onReset}
        onRunBatch={hp.onRunBatch}
        workersRunning={hp.workersRunning}
        onToggleWorkers={handleToggleWorkers}
        stackEfRangeText={hp.stackEfRangeText}
        onChangeStackEfRangeText={hp.setStackEfRangeText}
        betRangeText={hp.betRangeText}
        onChangeBetRangeText={hp.setBetRangeText}
        rangeListText={hp.rangeListText}
        onChangeRangeListText={hp.setRangeListText}
        linkFilter={hp.linkFilter}
        onChangeLinkFilter={hp.setLinkFilter}
        onClearFilters={hp.onClearFilters}
      />

      <div style={{ height: 10 }} />

      {hp.mode === "REAL" && (
        <>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <button disabled={!hp.canLoad} onClick={handleToggleWorkers} title="Lanza 4 instancias del worker">
              {hp.workersRunning ? "Stop workers" : "Run workers (loop, 4 instances)"}
            </button>

            <span style={{ fontSize: 12, opacity: 0.75 }}>
              xml: {CHAMPION_XML_DIR} | archive: {XML_ARCHIVE_DIR}
            </span>
          </div>

          <div style={{ height: 10 }} />
        </>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr",
          gap: 16,
          alignItems: "start",
        }}
      >
        <TournamentsTable rows={hp.tournaments ?? []} />
        <HandsTableBlock
          mode={hp.mode}
          realRows={hp.sortedRealRows}
          obsRows={hp.sortedObsRows}
          dbPath={hp.dbPath}
          sortKey={hp.sortKey}
          sortAsc={hp.sortAsc}
          onSort={hp.onSort}
          canRunOne={canRunOne}
          onRunOneForImage={hp.onRunOneForImage}
          lastLog={hp.lastLog}
        />
        <SpotsRealTable rows={hp.spotsReal ?? []} />
        <PlayersTableBlock rows={hp.players ?? []} />
        <WorkerProfileTableBlock rows={hp.workerProfile ?? []} />
      </div>

      {hp.obsFooterText ? (
        <div style={{ marginTop: 10, fontSize: 12, opacity: 0.8 }}>{hp.obsFooterText}</div>
      ) : null}

      <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
        {hp.actionStatus ? <div>{hp.actionStatus}</div> : null}
        {hp.lastLog ? <pre style={{ whiteSpace: "pre-wrap" }}>{hp.lastLog}</pre> : null}
      </div>
    </div>
  );
}
