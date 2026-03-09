import type { HandRealRow } from "../../db";
import { formatBoardCompact, formatCardsString } from "./realHandsFormatters";

type Props = {
  rows: HandRealRow[];
  getSpotPng: (h: HandRealRow) => string;
  onOpenHand: (h: HandRealRow) => void;
  onOpenImage: (h: HandRealRow) => void;
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

export default function RealHandsTableBody({
  rows,
  getSpotPng,
  onOpenHand,
  onOpenImage,
}: Props) {
  return (
    <tbody>
      {rows.map((h) => {
        const spotPng = getSpotPng(h);
        const audit = h.ocr_audit_summary || "NO OCR";
        const colors = auditColors(h.ocr_audit_status);

        const auditTitle = [
          `audit=${audit}`,
          h.ocr_match_method ? `match=${h.ocr_match_method}` : "",
          h.ocr_match_score != null ? `score=${h.ocr_match_score}` : "",
          h.ocr_mano_raw ? `ocr_cards=${h.ocr_mano_raw}` : "",
          h.wc_reason ? `reason=${h.wc_reason}` : "",
        ]
          .filter(Boolean)
          .join(" | ");

        return (
          <tr
            key={h.id}
            style={{ borderBottom: "1px solid #f0f0f0", cursor: "pointer" }}
            onClick={() => onOpenHand(h)}
            title="Click para abrir"
          >
            <td style={{ padding: "6px 8px", whiteSpace: "nowrap" }}>
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
            </td>

            <td style={{ padding: "6px 8px", whiteSpace: "nowrap" }}>
              <b>{h.gamecode}</b>
            </td>

            <td style={{ padding: "6px 8px", whiteSpace: "nowrap" }}>
              {h.startdate || ""}
            </td>

            <td style={{ padding: "6px 8px", whiteSpace: "nowrap" }}>
              {h.sb} / {h.bb}
            </td>

            <td style={{ padding: "6px 8px", whiteSpace: "nowrap" }}>
              {formatCardsString(h.hero_cards || "")}
            </td>

            <td style={{ padding: "6px 8px", whiteSpace: "nowrap" }}>
              {formatBoardCompact(h.flop || "", h.turn || "", h.river || "")}
            </td>

            <td style={{ padding: "6px 8px", whiteSpace: "nowrap" }}>
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
            </td>

            <td style={{ padding: "6px 8px", whiteSpace: "nowrap", opacity: 0.8 }}>
              {h.room} / {h.hero}
            </td>
          </tr>
        );
      })}
    </tbody>
  );
}
