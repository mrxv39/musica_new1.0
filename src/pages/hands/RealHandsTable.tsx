/// C:\Users\Usuario\Desktop\proyectos\poker_boss\src\pages\hands\RealHandsTable.tsx
import React from "react";
import type { HandRealRow } from "../../db";
import RealHandModal from "./RealHandModal";

function suitLower(s: string) {
  const u = (s || "").toUpperCase();
  if (u === "C") return "c";
  if (u === "D") return "d";
  if (u === "H") return "h";
  if (u === "S") return "s";
  return "?";
}

function rankPoker(r: string) {
  const u = (r || "").toUpperCase();
  if (u === "10") return "T";
  return u;
}

/**
 * Token DB examples:
 *  - "CK" (suit first) => Kc
 *  - "D10" => Td
 *  - "HA" => Ah
 *  - "X" / "XX" => X
 */
function formatCardToken(tok: string): string {
  const t = (tok || "").trim();
  if (!t) return "";
  const u = t.toUpperCase();
  if (u === "X" || u === "XX") return "X";

  const suit = u.slice(0, 1);
  const rank = u.slice(1);

  if (!rank) return t;

  return `${rankPoker(rank)}${suitLower(suit)}`;
}

function formatCardsString(s: string): string {
  const parts = (s || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "-";
  return parts.map(formatCardToken).join(" ");
}

function formatBoardCompact(flop: string, turn: string, river: string): string {
  const f = flop ? `F:${formatCardsString(flop)}` : "F:-";
  const t = turn ? `T:${formatCardsString(turn)}` : "T:-";
  const r = river ? `R:${formatCardsString(river)}` : "R:-";
  return `${f} ${t} ${r}`;
}

export function RealHandsTable({
  rows,
  dbPath,
}: {
  rows: HandRealRow[];
  dbPath: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [sel, setSel] = React.useState<HandRealRow | null>(null);

  const openHand = (h: HandRealRow) => {
    setSel(h);
    setOpen(true);
  };

  const close = () => {
    setOpen(false);
    setSel(null);
  };

  return (
    <>
      <RealHandModal open={open} dbPath={dbPath} hand={sel} onClose={close} />

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: "6px 8px", whiteSpace: "nowrap" }}>
              Gamecode
            </th>
            <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: "6px 8px", whiteSpace: "nowrap" }}>
              Start
            </th>
            <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: "6px 8px", whiteSpace: "nowrap" }}>
              Blinds
            </th>
            <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: "6px 8px", whiteSpace: "nowrap" }}>
              Hero cards
            </th>
            <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: "6px 8px", whiteSpace: "nowrap" }}>
              Board
            </th>
            <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: "6px 8px", whiteSpace: "nowrap" }}>
              Room/Hero
            </th>
          </tr>
        </thead>

        <tbody>
          {rows.map((h) => (
            <tr
              key={h.id}
              style={{ borderBottom: "1px solid #f0f0f0", cursor: "pointer" }}
              onClick={() => openHand(h)}
              title="Click para abrir"
            >
              <td style={{ padding: "6px 8px", whiteSpace: "nowrap" }}>
                <b>{h.gamecode}</b>
              </td>
              <td style={{ padding: "6px 8px", whiteSpace: "nowrap" }}>{h.startdate || ""}</td>
              <td style={{ padding: "6px 8px", whiteSpace: "nowrap" }}>
                {h.sb} / {h.bb}
              </td>
              <td style={{ padding: "6px 8px", whiteSpace: "nowrap" }}>{formatCardsString(h.hero_cards || "")}</td>
              <td style={{ padding: "6px 8px", whiteSpace: "nowrap" }}>
                {formatBoardCompact(h.flop || "", h.turn || "", h.river || "")}
              </td>
              <td style={{ padding: "6px 8px", whiteSpace: "nowrap", opacity: 0.8 }}>
                {h.room} / {h.hero}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>
        Rows: {rows.length} | DB actual: {dbPath}
      </div>
    </>
  );
}

export default RealHandsTable;
