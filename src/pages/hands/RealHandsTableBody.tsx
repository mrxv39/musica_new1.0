import React from "react";
import type { HandRealRow } from "../../db";
import { formatBoardCompact, formatCardsString } from "./realHandsFormatters";

/** Column ids in display order; when visibleColumnIds is passed, only these are shown. */
export const REAL_HANDS_BODY_COLUMN_IDS = [
  "icon",
  "gamecode",
  "startdate",
  "blinds",
  "hero_cards",
  "board",
  "ocr_audit",
  "tournament",
  "room_hero",
] as const;

type Props = {
  rows: HandRealRow[];
  getSpotPng: (h: HandRealRow) => string;
  onOpenHand: (h: HandRealRow) => void;
  onOpenImage: (h: HandRealRow) => void;
  /** When set, only these columns are rendered (order preserved). */
  visibleColumnIds?: string[];
  copyHandJson?: (h: HandRealRow) => void;
  copiedId?: number | null;
};

function auditColors(status?: HandRealRow["ocr_audit_status"]) {
  if (status === "ok") {
    return { bg: "#eefaf0", border: "#cfe9d5", fg: "#1d6b35" };
  }
  if (status === "warn") {
    return { bg: "#fff7e8", border: "#f0ddb3", fg: "#8a6116" };
  }
  if (status === "diff") {
    return { bg: "#fdeeee", border: "#efcaca", fg: "#9b2c2c" };
  }
  return { bg: "#f4f4f4", border: "#dddddd", fg: "#666666" };
}

function tournamentLabel(h: HandRealRow): string {
  const name = String(h.tournament_name || "").trim();
  const code = String(h.tournament_code || "").trim();
  if (name && code) return `${name} (${code})`;
  if (name) return name;
  if (code) return code;
  return "";
}

const cellStyle = { padding: "6px 8px" as const, whiteSpace: "nowrap" as const };

const copyBtnStyle: React.CSSProperties = { padding: "2px 6px", fontSize: 11, cursor: "pointer", borderRadius: 4, border: "1px solid #ccc", background: "#fff" };

export default function RealHandsTableBody({
  rows,
  getSpotPng,
  onOpenHand,
  onOpenImage,
  visibleColumnIds,
  copyHandJson,
  copiedId,
}: Props) {
  const cols =
    visibleColumnIds && visibleColumnIds.length > 0
      ? visibleColumnIds.filter((id) => REAL_HANDS_BODY_COLUMN_IDS.includes(id as any))
      : [...REAL_HANDS_BODY_COLUMN_IDS];

  return (
    <tbody>
      {rows.map((h) => {
        const spotPng = getSpotPng(h);
        const audit = h.ocr_audit_summary || "NO OCR";
        const colors = auditColors(h.ocr_audit_status);
        const tournament = tournamentLabel(h);

        const auditTitle = [
          `audit=${audit}`,
          h.ocr_match_method ? `match=${h.ocr_match_method}` : "",
          h.ocr_match_score != null ? `score=${h.ocr_match_score}` : "",
          h.ocr_mano_raw ? `ocr_cards=${h.ocr_mano_raw}` : "",
          h.wc_reason ? `reason=${h.wc_reason}` : "",
        ]
          .filter(Boolean)
          .join(" | ");

        const cells: Record<string, React.ReactNode> = {
          icon: (
            <button
              disabled={!spotPng}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onOpenImage(h);
              }}
              title={spotPng ? "Abrir screenshot (spot_png)" : "Sin screenshot enlazado"}
              style={{
                padding: "4px 8px",
                borderRadius: 8,
                border: "1px solid #ddd",
                background: spotPng ? "#fff" : "#f6f6f6",
                cursor: spotPng ? "pointer" : "not-allowed",
                opacity: spotPng ? 1 : 0.5,
              }}
            >
              📷
            </button>
          ),
          gamecode: <b>{h.gamecode}</b>,
          startdate: h.startdate || "",
          blinds: `${h.sb} / ${h.bb}`,
          hero_cards: formatCardsString(h.hero_cards || ""),
          board: formatBoardCompact(h.flop || "", h.turn || "", h.river || ""),
          ocr_audit: (
            <span
              title={auditTitle}
              style={{
                display: "inline-block",
                padding: "3px 8px",
                borderRadius: 999,
                border: `1px solid ${colors.border}`,
                background: colors.bg,
                color: colors.fg,
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              {audit}
            </span>
          ),
          tournament: <span style={{ opacity: tournament ? 0.9 : 0.5 }}>{tournament}</span>,
          room_hero: <span style={{ opacity: 0.8 }}>{h.room} / {h.hero}</span>,
        };

        return (
          <tr
            key={h.id}
            style={{ borderBottom: "1px solid #f0f0f0", cursor: "pointer" }}
            onClick={() => onOpenHand(h)}
            title="Click para abrir"
          >
            <td style={cellStyle}>
              {copyHandJson && (
                <button
                  style={copyBtnStyle}
                  title="Copiar JSON de la mano"
                  onClick={(e) => { e.stopPropagation(); copyHandJson(h); }}
                >
                  {copiedId === h.id ? "Copied" : "Copy"}
                </button>
              )}
            </td>
            {cols.map((id) => (
              <td key={id} style={cellStyle}>
                {cells[id] ?? ""}
              </td>
            ))}
          </tr>
        );
      })}
    </tbody>
  );
}
