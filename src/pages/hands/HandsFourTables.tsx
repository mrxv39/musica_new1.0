import React from "react";
import type { TournamentRow, SpotRow, WorkerProfileRow } from "../../db";
import type { PlayerRow } from "../../db/players";
import type { HandRealRow } from "../../db";
import type { HandsObsRow } from "../../db";
import type { HandsSortKey } from "./sortHands";
import type { ColumnConfigItem } from "./HandsColumnsConfigModal";
import { HandsColumnsConfigModal } from "./HandsColumnsConfigModal";
import { useVisibleColumns } from "./useVisibleColumns";
import RealHandsTable from "./RealHandsTable";
import HandsTable from "./HandsTable";
import { makeHandsColumns } from "./handsColumns";

const TOURNAMENTS_STORAGE_KEY = "hands.tournaments.visibleColumns";
const TOURNAMENTS_COLUMNS: ColumnConfigItem[] = [
  { id: "id", label: "ID" },
  { id: "tournamentcode", label: "Code" },
  { id: "tournamentname", label: "Name" },
  { id: "startdate", label: "Start date" },
  { id: "room", label: "Room" },
  { id: "hero", label: "Hero" },
  { id: "source_file", label: "Source file" },
  { id: "created_at", label: "Created" },
];

const SPOTS_STORAGE_KEY = "hands.spots.visibleColumns";
const SPOTS_COLUMNS: ColumnConfigItem[] = [
  { id: "id", label: "ID" },
  { id: "mesa", label: "Mesa" },
  { id: "image_path", label: "Image" },
  { id: "ts", label: "Ts" },
  { id: "time", label: "Time" },
  { id: "p1stack", label: "P1 stack" },
  { id: "p2stack", label: "P2 stack" },
  { id: "p3stack", label: "P3 stack" },
  { id: "p1bet", label: "P1 bet" },
  { id: "p2bet", label: "P2 bet" },
  { id: "p3bet", label: "P3 bet" },
  { id: "p1name", label: "P1 name" },
  { id: "p2name", label: "P2 name" },
  { id: "p3name", label: "P3 name" },
  { id: "tipo_p2", label: "Tipo P2" },
  { id: "tipo_p3", label: "Tipo P3" },
  { id: "created_at", label: "Created" },
];

/** Derived spot columns: id -> [row json key, object key] */
const SPOTS_DERIVED: Record<string, [string, string]> = {
  p1stack: ["stacks_json", "p1"],
  p2stack: ["stacks_json", "p2"],
  p3stack: ["stacks_json", "p3"],
  p1bet: ["bets_json", "p1"],
  p2bet: ["bets_json", "p2"],
  p3bet: ["bets_json", "p3"],
  p1name: ["names_json", "p1"],
  p2name: ["names_json", "p2"],
  p3name: ["names_json", "p3"],
};

function getDerivedSpotCell(row: SpotRow, columnId: string): string {
  const pair = SPOTS_DERIVED[columnId];
  if (!pair) return "";
  const [jsonKey, objKey] = pair;
  const jsonStr = (row as Record<string, unknown>)[jsonKey];
  if (typeof jsonStr !== "string" || !jsonStr.trim()) return "";
  try {
    const obj = JSON.parse(jsonStr) as Record<string, unknown>;
    const v = obj[objKey];
    if (v == null) return "";
    return typeof v === "number" ? String(v) : String(v);
  } catch {
    return "";
  }
}

const PLAYERS_STORAGE_KEY = "hands.players.visibleColumns";
const PLAYERS_COLUMNS: ColumnConfigItem[] = [
  { id: "id", label: "ID" },
  { id: "name", label: "Name" },
  { id: "tipo", label: "Tipo" },
  { id: "created_at", label: "Created" },
];

const WORKER_PROFILE_STORAGE_KEY = "hands.workerProfile.visibleColumns";
const WORKER_PROFILE_COLUMNS: ColumnConfigItem[] = [
  { id: "mesa", label: "Mesa" },
  { id: "n", label: "N spots" },
  { id: "ocr_avg", label: "OCR avg (s)" },
  { id: "preflop_avg", label: "Preflop avg (s)" },
  { id: "time_gate_avg", label: "Time gate avg (s)" },
  { id: "ocr_bets", label: "OCR bets (s)" },
  { id: "ocr_stacks", label: "OCR stacks (s)" },
  { id: "ocr_names", label: "OCR names (s)" },
  { id: "ocr_dealer", label: "OCR dealer (s)" },
  { id: "ocr_gamecode", label: "OCR gamecode (s)" },
  { id: "total_avg", label: "Total avg (s)" },
];

const HANDS_OBS_STORAGE_KEY = "hands.visibleColumns";
const HANDS_REAL_STORAGE_KEY = "hands.realHands.visibleColumns";
const REAL_HANDS_COLUMNS: ColumnConfigItem[] = [
  { id: "icon", label: "📷" },
  { id: "gamecode", label: "Gamecode" },
  { id: "startdate", label: "Start" },
  { id: "blinds", label: "Blinds" },
  { id: "hero_cards", label: "Hero cards" },
  { id: "board", label: "Board" },
  { id: "ocr_audit", label: "OCR Audit" },
  { id: "tournament", label: "Tournament" },
  { id: "room_hero", label: "Room/Hero" },
];

const tableBlockStyle: React.CSSProperties = {
  border: "1px solid #ddd",
  borderRadius: 8,
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
  minHeight: 200,
  maxHeight: 360,
};
const tableTitleStyle: React.CSSProperties = {
  padding: "8px 12px",
  background: "#f5f5f5",
  fontWeight: 600,
  fontSize: 14,
  borderBottom: "1px solid #ddd",
};
const tableScrollStyle: React.CSSProperties = {
  overflow: "auto",
  flex: 1,
};
const smallTableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 12,
};
const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "6px 8px",
  borderBottom: "1px solid #ddd",
  background: "#fafafa",
};
const tdStyle: React.CSSProperties = {
  padding: "6px 8px",
  borderBottom: "1px solid #eee",
};

const configButtonStyle: React.CSSProperties = {
  padding: "4px 8px",
  cursor: "pointer",
  border: "1px solid #ddd",
  background: "#fff",
  borderRadius: 6,
  fontSize: 12,
  marginLeft: "auto",
};

type TournamentsTableProps = { rows: TournamentRow[] };
export function TournamentsTable({ rows }: TournamentsTableProps) {
  const [configOpen, setConfigOpen] = React.useState(false);
  const { visibleIds, visibleColumns, onChangeVisibleIds } = useVisibleColumns(
    TOURNAMENTS_COLUMNS,
    TOURNAMENTS_STORAGE_KEY
  );
  const cols = visibleColumns.length > 0 ? visibleColumns : TOURNAMENTS_COLUMNS;

  return (
    <div style={tableBlockStyle}>
      <div style={{ ...tableTitleStyle, display: "flex", alignItems: "center", gap: 8 }}>
        Tournaments
        <button onClick={() => setConfigOpen(true)} style={configButtonStyle} title="Selecciona columnas">
          Config
        </button>
      </div>
      <HandsColumnsConfigModal
        open={configOpen}
        columns={TOURNAMENTS_COLUMNS}
        visibleIds={visibleIds.length > 0 ? visibleIds : TOURNAMENTS_COLUMNS.map((c) => c.id)}
        onChangeVisibleIds={onChangeVisibleIds}
        onClose={() => setConfigOpen(false)}
        storageKey={TOURNAMENTS_STORAGE_KEY}
        title="Tournaments – columnas"
      />
      <div style={tableScrollStyle}>
        <table style={smallTableStyle}>
          <thead>
            <tr>
              {cols.map((c) => (
                <th key={c.id} style={thStyle}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={cols.length} style={tdStyle}>Rows: 0</td></tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id}>
                  {cols.map((c) => (
                    <td key={c.id} style={tdStyle}>
                      {String((r as Record<string, unknown>)[c.id] ?? "")}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

type SpotsTableProps = { rows: SpotRow[] };
export function SpotsRealTable({ rows }: SpotsTableProps) {
  const [configOpen, setConfigOpen] = React.useState(false);
  const { visibleIds, visibleColumns, onChangeVisibleIds } = useVisibleColumns(
    SPOTS_COLUMNS,
    SPOTS_STORAGE_KEY
  );
  const cols = visibleColumns.length > 0 ? visibleColumns : SPOTS_COLUMNS;

  return (
    <div style={tableBlockStyle}>
      <div style={{ ...tableTitleStyle, display: "flex", alignItems: "center", gap: 8 }}>
        Spots
        <button onClick={() => setConfigOpen(true)} style={configButtonStyle} title="Selecciona columnas">
          Config
        </button>
      </div>
      <HandsColumnsConfigModal
        open={configOpen}
        columns={SPOTS_COLUMNS}
        visibleIds={visibleIds.length > 0 ? visibleIds : SPOTS_COLUMNS.map((c) => c.id)}
        onChangeVisibleIds={onChangeVisibleIds}
        onClose={() => setConfigOpen(false)}
        storageKey={SPOTS_STORAGE_KEY}
        title="Spots – columnas"
      />
      <div style={tableScrollStyle}>
        <table style={smallTableStyle}>
          <thead>
            <tr>
              {cols.map((c) => (
                <th key={c.id} style={thStyle}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={cols.length} style={tdStyle}>Rows: 0</td></tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id}>
                  {cols.map((c) => {
                    const isDerived = c.id in SPOTS_DERIVED;
                    let cell: string;
                    if (c.id === "time") {
                      const val = (r as Record<string, unknown>)[c.id];
                      cell = val != null && typeof val === "number" ? Number(val).toFixed(3) : "";
                    } else {
                      cell = isDerived ? getDerivedSpotCell(r, c.id) : String((r as Record<string, unknown>)[c.id] ?? "");
                    }
                    return (
                      <td key={c.id} style={tdStyle}>
                        {cell || "–"}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

type PlayersTableBlockProps = { rows: PlayerRow[] };
export function PlayersTableBlock({ rows }: PlayersTableBlockProps) {
  const [configOpen, setConfigOpen] = React.useState(false);
  const { visibleIds, visibleColumns, onChangeVisibleIds } = useVisibleColumns(
    PLAYERS_COLUMNS,
    PLAYERS_STORAGE_KEY
  );
  const cols = visibleColumns.length > 0 ? visibleColumns : PLAYERS_COLUMNS;

  return (
    <div style={tableBlockStyle}>
      <div style={{ ...tableTitleStyle, display: "flex", alignItems: "center", gap: 8 }}>
        Players
        <button onClick={() => setConfigOpen(true)} style={configButtonStyle} title="Selecciona columnas">
          Config
        </button>
      </div>
      <HandsColumnsConfigModal
        open={configOpen}
        columns={PLAYERS_COLUMNS}
        visibleIds={visibleIds.length > 0 ? visibleIds : PLAYERS_COLUMNS.map((c) => c.id)}
        onChangeVisibleIds={onChangeVisibleIds}
        onClose={() => setConfigOpen(false)}
        storageKey={PLAYERS_STORAGE_KEY}
        title="Players – columnas"
      />
      <div style={tableScrollStyle}>
        <table style={smallTableStyle}>
          <thead>
            <tr>
              {cols.map((c) => (
                <th key={c.id} style={thStyle}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={cols.length} style={tdStyle}>Rows: 0</td></tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id}>
                  {cols.map((c) => (
                    <td key={c.id} style={tdStyle}>
                      {String((r as Record<string, unknown>)[c.id] ?? "")}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

type WorkerProfileTableBlockProps = { rows: WorkerProfileRow[] };
export function WorkerProfileTableBlock({ rows }: WorkerProfileTableBlockProps) {
  const [configOpen, setConfigOpen] = React.useState(false);
  const { visibleIds, visibleColumns, onChangeVisibleIds } = useVisibleColumns(
    WORKER_PROFILE_COLUMNS,
    WORKER_PROFILE_STORAGE_KEY
  );
  const cols = visibleColumns.length > 0 ? visibleColumns : WORKER_PROFILE_COLUMNS;

  return (
    <div style={tableBlockStyle}>
      <div style={{ ...tableTitleStyle, display: "flex", alignItems: "center", gap: 8 }}>
        Worker profile (avg per mesa)
        <button onClick={() => setConfigOpen(true)} style={configButtonStyle} title="Selecciona columnas">
          Config
        </button>
      </div>
      <HandsColumnsConfigModal
        open={configOpen}
        columns={WORKER_PROFILE_COLUMNS}
        visibleIds={visibleIds.length > 0 ? visibleIds : WORKER_PROFILE_COLUMNS.map((c) => c.id)}
        onChangeVisibleIds={onChangeVisibleIds}
        onClose={() => setConfigOpen(false)}
        storageKey={WORKER_PROFILE_STORAGE_KEY}
        title="Worker profile – columnas"
      />
      <div style={tableScrollStyle}>
        <table style={smallTableStyle}>
          <thead>
            <tr>
              {cols.map((c) => (
                <th key={c.id} style={thStyle}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={cols.length} style={tdStyle}>
                  Rows: 0
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.mesa}>
                  {cols.map((c) => {
                    const v = (r as Record<string, unknown>)[c.id];
                    let cell: string;
                    if (v == null) {
                      cell = "";
                    } else if (typeof v === "number" && c.id !== "mesa" && c.id !== "n") {
                      cell = Number(v).toFixed(3);
                    } else {
                      cell = String(v);
                    }
                    return (
                      <td key={c.id} style={tdStyle}>
                        {cell || "–"}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

type HandsTableBlockProps = {
  mode: "OBS" | "REAL";
  realRows: HandRealRow[];
  obsRows: HandsObsRow[];
  dbPath: string;
  sortKey: HandsSortKey;
  sortAsc: boolean;
  onSort: (key: HandsSortKey) => void;
  canRunOne: boolean;
  onRunOneForImage: (imagePath: string) => Promise<string>;
  lastLog: string;
};
export function HandsTableBlock({
  mode,
  realRows,
  obsRows,
  dbPath,
  sortKey,
  sortAsc,
  onSort,
  canRunOne,
  onRunOneForImage,
  lastLog,
}: HandsTableBlockProps) {
  const [configOpen, setConfigOpen] = React.useState(false);

  const obsColumns = React.useMemo(
    () => makeHandsColumns(() => {}, obsRows[0] ?? null),
    [obsRows]
  );
  const obsColumnsConfig = React.useMemo<ColumnConfigItem[]>(
    () => obsColumns.map((c) => ({ id: c.id, label: c.label })),
    [obsColumns]
  );
  const obsVisible = useVisibleColumns(obsColumnsConfig, HANDS_OBS_STORAGE_KEY);
  const realVisible = useVisibleColumns(REAL_HANDS_COLUMNS, HANDS_REAL_STORAGE_KEY);

  return (
    <div style={{ ...tableBlockStyle, maxHeight: 420 }}>
      <div style={{ ...tableTitleStyle, display: "flex", alignItems: "center", gap: 8 }}>
        Hands
        <button onClick={() => setConfigOpen(true)} style={configButtonStyle} title="Selecciona columnas">
          Config
        </button>
      </div>

      {mode === "OBS" && (
        <HandsColumnsConfigModal
          open={configOpen}
          columns={obsColumnsConfig}
          visibleIds={obsVisible.visibleIds.length > 0 ? obsVisible.visibleIds : obsColumnsConfig.map((c) => c.id)}
          onChangeVisibleIds={obsVisible.onChangeVisibleIds}
          onClose={() => setConfigOpen(false)}
          storageKey={HANDS_OBS_STORAGE_KEY}
          title="Hands – columnas"
        />
      )}
      {mode === "REAL" && (
        <HandsColumnsConfigModal
          open={configOpen}
          columns={REAL_HANDS_COLUMNS}
          visibleIds={realVisible.visibleIds.length > 0 ? realVisible.visibleIds : REAL_HANDS_COLUMNS.map((c) => c.id)}
          onChangeVisibleIds={realVisible.onChangeVisibleIds}
          onClose={() => setConfigOpen(false)}
          storageKey={HANDS_REAL_STORAGE_KEY}
          title="Hands (real) – columnas"
        />
      )}

      <div style={tableScrollStyle}>
        {mode === "REAL" ? (
          <RealHandsTable
            rows={realRows}
            dbPath={dbPath}
            visibleColumnIds={realVisible.visibleIds.length > 0 ? realVisible.visibleIds : undefined}
          />
        ) : (
          <HandsTable
            rows={obsRows}
            onSort={onSort}
            sortKey={sortKey}
            sortAsc={sortAsc}
            canRunOne={canRunOne}
            onRunOneForImage={onRunOneForImage}
            lastLog={lastLog}
            dbPath={dbPath}
            visibleIds={obsVisible.visibleIds}
            onChangeVisibleIds={obsVisible.onChangeVisibleIds}
          />
        )}
      </div>
    </div>
  );
}
