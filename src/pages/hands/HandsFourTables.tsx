import React from "react";
import type { TournamentRow, SpotRow, WorkerProfileRow } from "../../db";
import type { PlayerRow } from "../../db/players";
import type { HandRealRow } from "../../db";
import type { HandsObsRow } from "../../db";
import type { HandsSortKey } from "./sortHands";
import type { ColumnConfigItem } from "./HandsColumnsConfigModal";
import { HandsColumnsConfigModal } from "./HandsColumnsConfigModal";
import { useVisibleColumns } from "./useVisibleColumns";
import {
  computeEffectiveStackBbFromSpot,
  extractSpotPositionsFromRawJson,
  fixBetsForMatching,
  getManoFromRawJson,
  safeParseJson,
} from "./handsTableUtils";
import { SpotDetailsModal } from "./SpotDetailsModal";
import RealHandsTable from "./RealHandsTable";
import HandsTable from "./HandsTable";
import { makeHandsColumns } from "./handsColumns";

const TOURNAMENTS_STORAGE_KEY = "hands.tournaments.visibleColumns";
const TOURNAMENTS_COLLAPSE_KEY = "hands.tournaments.collapsed";
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
const SPOTS_COLLAPSE_KEY = "hands.spots.collapsed";
const SPOTS_COLUMNS: ColumnConfigItem[] = [
  { id: "id", label: "ID" },
  { id: "strategy_id", label: "Strategy ID" },
  { id: "strategy_move", label: "Move" },
  { id: "strategy_bet_min", label: "Bet min" },
  { id: "strategy_bet_max", label: "Bet max" },
  { id: "mesa", label: "Mesa" },
  { id: "image_path", label: "Image" },
  { id: "ts", label: "Ts" },
  { id: "time", label: "Time" },
  { id: "mano", label: "Mano" },
  { id: "stackefectivo", label: "SE" },
  { id: "hero_pos", label: "Hero pos" },
  { id: "p2_pos", label: "P2 pos" },
  { id: "p3_pos", label: "P3 pos" },
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
const PLAYERS_COLLAPSE_KEY = "hands.players.collapsed";
const PLAYERS_COLUMNS: ColumnConfigItem[] = [
  { id: "id", label: "ID" },
  { id: "name", label: "Name" },
  { id: "tipo", label: "Tipo" },
  { id: "created_at", label: "Created" },
];

const WORKER_PROFILE_STORAGE_KEY = "hands.workerProfile.visibleColumns";
const WORKER_PROFILE_COLLAPSE_KEY = "hands.workerProfile.collapsed";
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
const HANDS_COLLAPSE_KEY = "hands.handsTable.collapsed";
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
};

type TournamentsTableProps = { rows: TournamentRow[] };
export function TournamentsTable({ rows }: TournamentsTableProps) {
  const [configOpen, setConfigOpen] = React.useState(false);
  const [collapsed, setCollapsed] = React.useState<boolean>(() => {
    try {
      return localStorage.getItem(TOURNAMENTS_COLLAPSE_KEY) === "true";
    } catch {
      return false;
    }
  });
  React.useEffect(() => {
    try {
      localStorage.setItem(TOURNAMENTS_COLLAPSE_KEY, collapsed ? "true" : "false");
    } catch {
      // ignore
    }
  }, [collapsed]);
  const { visibleIds, visibleColumns, onChangeVisibleIds } = useVisibleColumns(
    TOURNAMENTS_COLUMNS,
    TOURNAMENTS_STORAGE_KEY
  );
  const cols = visibleColumns.length > 0 ? visibleColumns : TOURNAMENTS_COLUMNS;

  return (
    <div style={tableBlockStyle}>
      <div style={{ ...tableTitleStyle, display: "flex", alignItems: "center", gap: 8 }}>
        Tournaments
        <button
          onClick={() => setCollapsed((v) => !v)}
          style={configButtonStyle}
          title={collapsed ? "Mostrar filas" : "Ocultar filas"}
        >
          {collapsed ? "Expandir" : "Colapsar"}
        </button>
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
      {collapsed ? (
        <div style={{ padding: "6px 8px", fontSize: 12, opacity: 0.7 }}>Tabla colapsada</div>
      ) : (
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
      )}
    </div>
  );
}

type SpotsTableProps = { rows: SpotRow[] };
export function SpotsRealTable({ rows }: SpotsTableProps) {
  const [configOpen, setConfigOpen] = React.useState(false);
  const [sortKey, setSortKey] = React.useState<string | null>(() => {
    try {
      return localStorage.getItem("hands.spots.sortKey");
    } catch {
      return null;
    }
  });
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">(() => {
    try {
      const v = localStorage.getItem("hands.spots.sortDir");
      return v === "desc" ? "desc" : "asc";
    } catch {
      return "asc";
    }
  });
  const [hoverRowId, setHoverRowId] = React.useState<number | null>(null);
  const [selectedRow, setSelectedRow] = React.useState<SpotRow | null>(null);
  const [copiedRowId, setCopiedRowId] = React.useState<number | null>(null);
  const [collapsed, setCollapsed] = React.useState<boolean>(() => {
    try {
      return localStorage.getItem(SPOTS_COLLAPSE_KEY) === "true";
    } catch {
      return false;
    }
  });
  React.useEffect(() => {
    try {
      localStorage.setItem(SPOTS_COLLAPSE_KEY, collapsed ? "true" : "false");
    } catch {
      // ignore
    }
  }, [collapsed]);
  React.useEffect(() => {
    try {
      if (sortKey) localStorage.setItem("hands.spots.sortKey", sortKey);
      localStorage.setItem("hands.spots.sortDir", sortDir);
    } catch {
      // ignore
    }
  }, [sortKey, sortDir]);
  const { visibleIds, visibleColumns, onChangeVisibleIds } = useVisibleColumns(
    SPOTS_COLUMNS,
    SPOTS_STORAGE_KEY
  );
  const cols = visibleColumns.length > 0 ? visibleColumns : SPOTS_COLUMNS;

  async function copySpotJson(row: SpotRow) {
    const r = row as any;
    const mano = getManoFromRawJson(r.raw_json);
    const se = computeEffectiveStackBbFromSpot({
      stacks_json: r.stacks_json,
      bets_json: r.bets_json,
      raw_json: r.raw_json,
    });

    const raw = safeParseJson<any>(r.raw_json ?? null);
    const posiciones =
      raw?.preflop?.ocr?.posiciones ?? raw?.preflop?.posiciones ?? raw?.preflop?.ocr?.pos ?? null;

    const hero_pos = String(posiciones?.p1 ?? "").toUpperCase().trim();
    const p2_pos = String(posiciones?.p2 ?? "").toUpperCase().trim();
    const p3_pos = String(posiciones?.p3 ?? "").toUpperCase().trim();
    const p2_tipo = String(r.tipo_p2 ?? "").toUpperCase().trim();
    const p3_tipo = String(r.tipo_p3 ?? "").toUpperCase().trim();

    const betFix = fixBetsForMatching({ hero_pos, bets_json: r.bets_json });

    const payload = {
      spot: { ...(r as Record<string, unknown>) },
      derived: {
        mano,
        se_bb: se.se_bb,
      },
      debug_match: {
        hand_class: mano || null,
        p1_se_bb: se.se_bb,
        p1_bet_bb_raw: betFix.p1_raw,
        p1_bet_bb_used: betFix.p1_used,
        p2_bet_bb_raw: betFix.p2_raw,
        p3_bet_bb_raw: betFix.p3_raw,
        hero_pos: hero_pos || null,
        p2_pos: p2_pos || null,
        p3_pos: p3_pos || null,
        p2_tipo: p2_tipo || null,
        p3_tipo: p3_tipo || null,
        situacion: hero_pos ? `${hero_pos}_vs_${p2_pos}_${p3_pos}_${p2_tipo}_${p3_tipo}` : null,
        bet_fix_reason: betFix.reason,
        se_reason: se.reason,
      },
      meta: {
        copied_at: new Date().toISOString(),
        version: 1,
      },
    };

    const text = JSON.stringify(payload, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      setCopiedRowId(Number(r.id) || null);
      window.setTimeout(() => setCopiedRowId((prev) => (prev === Number(r.id) ? null : prev)), 1200);
    } catch {
      try {
        window.alert("No se pudo copiar al portapapeles.");
      } catch {
        // ignore
      }
    }
  }

  function getCellValue(row: SpotRow, colId: string): string {
    const isDerived = colId in SPOTS_DERIVED;
    if (colId === "time") {
      const val = (row as Record<string, unknown>)[colId];
      return val != null && typeof val === "number" ? Number(val).toFixed(3) : "";
    } else if (colId === "mano") {
      return getManoFromRawJson((row as Record<string, unknown>).raw_json as string | undefined);
    } else if (colId === "stackefectivo") {
      const r = row as any;
      const out = computeEffectiveStackBbFromSpot({
        stacks_json: r.stacks_json,
        bets_json: r.bets_json,
        raw_json: r.raw_json,
      });
      return out.se_bb != null ? String(out.se_bb.toFixed(2)) : "";
    } else if (colId === "hero_pos" || colId === "p2_pos" || colId === "p3_pos") {
      const pos = extractSpotPositionsFromRawJson((row as any).raw_json);
      if (!pos) return "";
      if (colId === "hero_pos") return pos.hero_pos;
      if (colId === "p2_pos") return pos.p2_pos;
      return pos.p3_pos;
    } else {
      return isDerived
        ? getDerivedSpotCell(row, colId)
        : String((row as Record<string, unknown>)[colId] ?? "");
    }
  }

  const sortedRows = React.useMemo(() => {
    if (!sortKey) return rows;
    const dir = sortDir === "desc" ? -1 : 1;
    const isNumeric = (id: string) =>
      id === "id" ||
      id === "mesa" ||
      id === "time" ||
      id === "stackefectivo" ||
      id === "strategy_id" ||
      id.endsWith("stack") ||
      id.endsWith("bet");
    const toNum = (s: string): number => {
      const n = Number(s);
      return Number.isFinite(n) ? n : Number.NEGATIVE_INFINITY;
    };
    const copy = rows.slice();
    copy.sort((a, b) => {
      const va = getCellValue(a, sortKey);
      const vb = getCellValue(b, sortKey);
      if (isNumeric(sortKey)) {
        const na = toNum(va);
        const nb = toNum(vb);
        return na === nb ? 0 : na < nb ? -1 * dir : 1 * dir;
      }
      // string compare
      return va.localeCompare(vb) * dir;
    });
    return copy;
  }, [rows, sortKey, sortDir]);

  function onClickHeader(id: string) {
    setSortKey((prev) => {
      if (prev === id) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        return prev;
      }
      setSortDir("asc");
      return id;
    });
  }

  return (
    <div style={tableBlockStyle}>
      <div style={{ ...tableTitleStyle, display: "flex", alignItems: "center", gap: 8 }}>
        Spots
        <button
          onClick={() => setCollapsed((v) => !v)}
          style={configButtonStyle}
          title={collapsed ? "Mostrar filas" : "Ocultar filas"}
        >
          {collapsed ? "Expandir" : "Colapsar"}
        </button>
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
      {collapsed ? (
        <div style={{ padding: "6px 8px", fontSize: 12, opacity: 0.7 }}>Tabla colapsada</div>
      ) : (
        <div style={tableScrollStyle}>
          <table style={smallTableStyle}>
            <thead>
              <tr>
                <th style={{ ...thStyle, width: 64 }}>Copy</th>
                {cols.map((c) => {
                  const isActive = sortKey === c.id;
                  const arrow = isActive ? (sortDir === "asc" ? " ▲" : " ▼") : "";
                  return (
                    <th
                      key={c.id}
                      style={{ ...thStyle, cursor: "pointer", userSelect: "none" }}
                      onClick={() => onClickHeader(c.id)}
                      role="button"
                      title="Ordenar"
                    >
                      {c.label}
                      {arrow}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={cols.length + 1} style={tdStyle}>Rows: 0</td></tr>
              ) : (
                sortedRows.map((r) => (
                  <tr
                    key={r.id}
                    style={{
                      background: hoverRowId === r.id ? "#f5f7fa" : undefined,
                      cursor: "pointer",
                    }}
                    onMouseEnter={() => setHoverRowId(r.id)}
                    onMouseLeave={() => setHoverRowId((prev) => (prev === r.id ? null : prev))}
                    onClick={() => setSelectedRow(r)}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelectedRow(r);
                      }
                    }}
                  >
                    <td style={tdStyle}>
                      <button
                        style={{ ...configButtonStyle, padding: "2px 6px", fontSize: 11 }}
                        title="Copiar JSON del spot"
                        onClick={(e) => {
                          e.stopPropagation();
                          copySpotJson(r);
                        }}
                      >
                        {copiedRowId === (r as any).id ? "Copied" : "Copy"}
                      </button>
                    </td>
                    {cols.map((c) => {
                      const cell = getCellValue(r, c.id);
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
      )}
      <SpotDetailsModal open={!!selectedRow} row={selectedRow} onClose={() => setSelectedRow(null)} />
    </div>
  );
}

type PlayersTableBlockProps = { rows: PlayerRow[] };
export function PlayersTableBlock({ rows }: PlayersTableBlockProps) {
  const [configOpen, setConfigOpen] = React.useState(false);
  const [collapsed, setCollapsed] = React.useState<boolean>(() => {
    try {
      return localStorage.getItem(PLAYERS_COLLAPSE_KEY) === "true";
    } catch {
      return false;
    }
  });
  React.useEffect(() => {
    try {
      localStorage.setItem(PLAYERS_COLLAPSE_KEY, collapsed ? "true" : "false");
    } catch {
      // ignore
    }
  }, [collapsed]);
  const { visibleIds, visibleColumns, onChangeVisibleIds } = useVisibleColumns(
    PLAYERS_COLUMNS,
    PLAYERS_STORAGE_KEY
  );
  const cols = visibleColumns.length > 0 ? visibleColumns : PLAYERS_COLUMNS;

  return (
    <div style={tableBlockStyle}>
      <div style={{ ...tableTitleStyle, display: "flex", alignItems: "center", gap: 8 }}>
        Players
        <button
          onClick={() => setCollapsed((v) => !v)}
          style={configButtonStyle}
          title={collapsed ? "Mostrar filas" : "Ocultar filas"}
        >
          {collapsed ? "Expandir" : "Colapsar"}
        </button>
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
      {collapsed ? (
        <div style={{ padding: "6px 8px", fontSize: 12, opacity: 0.7 }}>Tabla colapsada</div>
      ) : (
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
      )}
    </div>
  );
}

type WorkerProfileTableBlockProps = { rows: WorkerProfileRow[] };
export function WorkerProfileTableBlock({ rows }: WorkerProfileTableBlockProps) {
  const [configOpen, setConfigOpen] = React.useState(false);
  const [collapsed, setCollapsed] = React.useState<boolean>(() => {
    try {
      return localStorage.getItem(WORKER_PROFILE_COLLAPSE_KEY) === "true";
    } catch {
      return false;
    }
  });
  React.useEffect(() => {
    try {
      localStorage.setItem(WORKER_PROFILE_COLLAPSE_KEY, collapsed ? "true" : "false");
    } catch {
      // ignore
    }
  }, [collapsed]);
  const { visibleIds, visibleColumns, onChangeVisibleIds } = useVisibleColumns(
    WORKER_PROFILE_COLUMNS,
    WORKER_PROFILE_STORAGE_KEY
  );
  const cols = visibleColumns.length > 0 ? visibleColumns : WORKER_PROFILE_COLUMNS;

  return (
    <div style={tableBlockStyle}>
      <div style={{ ...tableTitleStyle, display: "flex", alignItems: "center", gap: 8 }}>
        Worker profile (avg per mesa)
        <button
          onClick={() => setCollapsed((v) => !v)}
          style={configButtonStyle}
          title={collapsed ? "Mostrar filas" : "Ocultar filas"}
        >
          {collapsed ? "Expandir" : "Colapsar"}
        </button>
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
      {collapsed ? (
        <div style={{ padding: "6px 8px", fontSize: 12, opacity: 0.7 }}>Tabla colapsada</div>
      ) : (
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
      )}
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
  onMarkReview?: (obsId: number, status: "ok" | "error" | null) => Promise<void>;
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
  onMarkReview,
  lastLog,
}: HandsTableBlockProps) {
  const [configOpen, setConfigOpen] = React.useState(false);
  const [collapsed, setCollapsed] = React.useState<boolean>(() => {
    try {
      return localStorage.getItem(HANDS_COLLAPSE_KEY) === "true";
    } catch {
      return false;
    }
  });
  React.useEffect(() => {
    try {
      localStorage.setItem(HANDS_COLLAPSE_KEY, collapsed ? "true" : "false");
    } catch {
      // ignore
    }
  }, [collapsed]);

  const [ocrFilter, setOcrFilter] = React.useState<"all" | "si" | "no">("all");

  const filteredRealRows = React.useMemo(() => {
    if (ocrFilter === "all") return realRows;
    if (ocrFilter === "si") return realRows.filter((r) => r.linked_obs_id != null);
    return realRows.filter((r) => r.linked_obs_id == null);
  }, [realRows, ocrFilter]);

  const filteredObsRows = React.useMemo(() => {
    if (mode !== "OBS" || ocrFilter === "all") return obsRows;
    if (ocrFilter === "si") return obsRows.filter((r) => (r as any).linked_hand_id != null && (r as any).linked_hand_id !== 0);
    return obsRows.filter((r) => (r as any).linked_hand_id == null || (r as any).linked_hand_id === 0);
  }, [obsRows, ocrFilter, mode]);

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

  const displayRealRows = mode === "REAL" ? filteredRealRows : realRows;
  const displayObsRows = mode === "OBS" ? filteredObsRows : obsRows;

  return (
    <div style={{ ...tableBlockStyle, maxHeight: 420 }}>
      <div style={{ ...tableTitleStyle, display: "flex", alignItems: "center", gap: 8 }}>
        {mode === "REAL" ? "Hands" : "Spots"}
        {(mode === "REAL" ? realRows : obsRows).length > 0 && (
          <>
            {(["all", "si", "no"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setOcrFilter(v)}
                style={{
                  ...configButtonStyle,
                  background: ocrFilter === v ? "#333" : undefined,
                  color: ocrFilter === v ? "#fff" : undefined,
                  fontWeight: ocrFilter === v ? 700 : 400,
                }}
              >
                {v === "all" ? "All" : v === "si" ? (mode === "REAL" ? "Si OCR" : "Linked") : (mode === "REAL" ? "No OCR" : "Unlinked")}
              </button>
            ))}
          </>
        )}
        <button
          onClick={() => setCollapsed((v) => !v)}
          style={configButtonStyle}
          title={collapsed ? "Mostrar filas" : "Ocultar filas"}
        >
          {collapsed ? "Expandir" : "Colapsar"}
        </button>
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
          title="Spots – columnas"
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

      {collapsed ? (
        <div style={{ padding: "6px 8px", fontSize: 12, opacity: 0.7 }}>Tabla colapsada</div>
      ) : (
        <div style={tableScrollStyle}>
          {mode === "REAL" ? (
            <RealHandsTable
              rows={displayRealRows}
              dbPath={dbPath}
              visibleColumnIds={realVisible.visibleIds.length > 0 ? realVisible.visibleIds : undefined}
            />
          ) : (
            <HandsTable
              rows={displayObsRows}
              onSort={onSort}
              sortKey={sortKey}
              sortAsc={sortAsc}
              canRunOne={canRunOne}
              onRunOneForImage={onRunOneForImage}
              onMarkReview={onMarkReview}
              lastLog={lastLog}
              dbPath={dbPath}
              visibleIds={obsVisible.visibleIds}
              onChangeVisibleIds={obsVisible.onChangeVisibleIds}
            />
          )}
        </div>
      )}
    </div>
  );
}
