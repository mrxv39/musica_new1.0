import React from "react";
import type { TournamentRow, SpotRealRow } from "../../db";
import type { PlayerRow } from "../../db/players";
import type { HandRealRow } from "../../db";
import type { HandsObsRow } from "../../db";
import type { HandsSortKey } from "./sortHands";
import RealHandsTable from "./RealHandsTable";
import HandsTable from "./HandsTable";

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

type TournamentsTableProps = { rows: TournamentRow[] };
export function TournamentsTable({ rows }: TournamentsTableProps) {
  return (
    <div style={tableBlockStyle}>
      <div style={tableTitleStyle}>Tournaments</div>
      <div style={tableScrollStyle}>
        <table style={smallTableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>id</th>
              <th style={thStyle}>code</th>
              <th style={thStyle}>name</th>
              <th style={thStyle}>startdate</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={4} style={tdStyle}>Rows: 0</td></tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id}>
                  <td style={tdStyle}>{r.id}</td>
                  <td style={tdStyle}>{r.tournamentcode ?? ""}</td>
                  <td style={tdStyle}>{r.tournamentname ?? ""}</td>
                  <td style={tdStyle}>{r.startdate ?? ""}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

type SpotsRealTableProps = { rows: SpotRealRow[] };
export function SpotsRealTable({ rows }: SpotsRealTableProps) {
  return (
    <div style={tableBlockStyle}>
      <div style={tableTitleStyle}>Spots</div>
      <div style={tableScrollStyle}>
        <table style={smallTableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>id</th>
              <th style={thStyle}>hand_id</th>
              <th style={thStyle}>gamecode</th>
              <th style={thStyle}>street</th>
              <th style={thStyle}>round</th>
              <th style={thStyle}>action_no</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={6} style={tdStyle}>Rows: 0</td></tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id}>
                  <td style={tdStyle}>{r.id}</td>
                  <td style={tdStyle}>{r.hand_id}</td>
                  <td style={tdStyle}>{String(r.gamecode ?? "").slice(0, 12)}</td>
                  <td style={tdStyle}>{r.street}</td>
                  <td style={tdStyle}>{r.round_no}</td>
                  <td style={tdStyle}>{r.action_no}</td>
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
  return (
    <div style={tableBlockStyle}>
      <div style={tableTitleStyle}>Players</div>
      <div style={tableScrollStyle}>
        <table style={smallTableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>id</th>
              <th style={thStyle}>name</th>
              <th style={thStyle}>tipo</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={3} style={tdStyle}>Rows: 0</td></tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id}>
                  <td style={tdStyle}>{r.id}</td>
                  <td style={tdStyle}>{r.name}</td>
                  <td style={tdStyle}>{r.tipo}</td>
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
  return (
    <div style={{ ...tableBlockStyle, maxHeight: 420 }}>
      <div style={tableTitleStyle}>Hands</div>
      <div style={tableScrollStyle}>
        {mode === "REAL" ? (
          <RealHandsTable rows={realRows} dbPath={dbPath} />
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
          />
        )}
      </div>
    </div>
  );
}
