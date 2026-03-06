import type { HandRealRow } from "../../db";
import { formatBoardCompact, formatCardsString } from "./realHandsFormatters";

type Props = {
  rows: HandRealRow[];
  getSpotPng: (h: HandRealRow) => string;
  onOpenHand: (h: HandRealRow) => void;
  onOpenImage: (h: HandRealRow) => void;
};

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

            <td style={{ padding: "6px 8px", whiteSpace: "nowrap", opacity: 0.8 }}>
              {h.room} / {h.hero}
            </td>
          </tr>
        );
      })}
    </tbody>
  );
}
