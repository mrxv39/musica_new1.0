// C:\Users\Usuario\Desktop\proyectos\poker_boss\src\pages\HandsPage.tsx
import React from "react";
import HandsToolbar from "./hands/HandsToolbar";
import BugReportBar from "../components/BugReportBar";
import {
  TournamentsTable,
  HandsTableBlock,
  PlayersTableBlock,
} from "./hands/HandsFourTables";
import { useHandsPage } from "./hands/useHandsPage";
import type { ReviewFilter } from "./hands/useHandsObs";
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
      </div>

      <div style={{ height: 8 }} />
      <BugReportBar />

      <div style={{ height: 10 }} />

      <ReviewFilterBar filter={hp.reviewFilter} onChange={hp.setReviewFilter} />

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
        {visibleBlocks.spots && (
          <HandsTableBlock
            mode="OBS"
            realRows={[]}
            obsRows={hp.sortedObsRows}
            dbPath={hp.dbPath}
            sortKey={hp.sortKey}
            sortAsc={hp.sortAsc}
            onSort={hp.onSort}
            canRunOne={false}
            onRunOneForImage={hp.onRunOneForImage}
            onMarkReview={hp.markReview}
            lastLog={hp.lastLog}
          />
        )}
        {visibleBlocks.hands && (
          <HandsTableBlock
            mode="REAL"
            realRows={hp.sortedRealRows}
            obsRows={[]}
            dbPath={hp.dbPath}
            sortKey={hp.sortKey}
            sortAsc={hp.sortAsc}
            onSort={hp.onSort}
            canRunOne={false}
            onRunOneForImage={hp.onRunOneForImage}
            onMarkReview={hp.markReview}
            lastLog={hp.lastLog}
          />
        )}
        {visibleBlocks.players && <PlayersTableBlock rows={hp.players ?? []} />}
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

const REVIEW_OPTIONS: { value: ReviewFilter; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "pending", label: "Pendientes" },
  { value: "ok", label: "OK" },
  { value: "error", label: "Errores" },
];

function ReviewFilterBar({
  filter,
  onChange,
}: {
  filter: ReviewFilter;
  onChange: (f: ReviewFilter) => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ fontSize: 12, fontWeight: 600, marginRight: 4 }}>Review:</span>
      {REVIEW_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          style={{
            padding: "4px 12px",
            borderRadius: 6,
            border: filter === opt.value ? "2px solid #333" : "1px solid #ccc",
            background: filter === opt.value ? "#333" : "#fff",
            color: filter === opt.value ? "#fff" : "#333",
            fontWeight: filter === opt.value ? 700 : 400,
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
