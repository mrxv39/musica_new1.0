// C:\Users\Usuario\Desktop\proyectos\poker_boss\src\pages\HandsPage.tsx
import React from "react";
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
import {
  HandsBlocksConfigModal,
  HandsVisibleBlocks,
  loadInitialVisibleBlocks,
  persistVisibleBlocks,
} from "./hands/HandsBlocksConfigModal";

export default function HandsPage() {
  const hp = useHandsPage();
  const [blocksConfigOpen, setBlocksConfigOpen] = React.useState(false);
  const [visibleBlocks, setVisibleBlocks] = React.useState<HandsVisibleBlocks>(() => loadInitialVisibleBlocks());

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <HandsToolbar
          canLoad={hp.canLoad}
          onRefresh={hp.loadOnce}
          auto={hp.auto}
          onToggleAuto={hp.setAuto}
          status={hp.uiStatus}
          busy={hp.busy}
          onReset={hp.onReset}
        />
        <button
          style={{
            marginLeft: "auto",
            padding: "6px 10px",
            cursor: "pointer",
            borderRadius: 6,
            border: "1px solid #ddd",
            background: "#fff",
            fontSize: 12,
          }}
          onClick={() => setBlocksConfigOpen(true)}
          title="Selecciona qué tablas se muestran"
        >
          Config tablas
        </button>
      </div>

      <HandsBlocksConfigModal
        open={blocksConfigOpen}
        visibleBlocks={visibleBlocks}
        onChangeVisibleBlocks={(next) => {
          persistVisibleBlocks(next);
          setVisibleBlocks(next);
        }}
        onClose={() => setBlocksConfigOpen(false)}
      />

      <div style={{ height: 10 }} />

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button disabled={!hp.canLoad} onClick={hp.onToggleWorkers} title="Lanza 4 instancias del worker">
          {hp.workersRunning ? "Stop workers" : "Run workers (loop, 4 instances)"}
        </button>

        <span style={{ fontSize: 12, opacity: 0.75 }}>
          xml: {CHAMPION_XML_DIR} | archive: {XML_ARCHIVE_DIR}
        </span>
      </div>

      <div style={{ height: 10 }} />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr",
          gap: 16,
          alignItems: "start",
        }}
      >
        {visibleBlocks.tournaments && <TournamentsTable rows={hp.tournaments ?? []} />}
        {visibleBlocks.hands && (
          <HandsTableBlock
            mode={hp.mode}
            realRows={hp.sortedRealRows}
            obsRows={hp.sortedObsRows}
            dbPath={hp.dbPath}
            sortKey={hp.sortKey}
            sortAsc={hp.sortAsc}
            onSort={hp.onSort}
            canRunOne={false}
            onRunOneForImage={hp.onRunOneForImage}
            lastLog={hp.lastLog}
          />
        )}
        {visibleBlocks.spots && <SpotsRealTable rows={hp.spotsReal ?? []} />}
        {visibleBlocks.players && <PlayersTableBlock rows={hp.players ?? []} />}
        {visibleBlocks.workerProfile && <WorkerProfileTableBlock rows={hp.workerProfile ?? []} />}
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
