/// C:\Users\Usuario\Desktop\proyectos\poker_boss\src\pages\hands\handsColumns.ts
import {
  extractBetMax,
  extractBetMin,
  extractMove,
  extractP1Bet,
  extractSituacion,
  extractStackEfectivo,
  extractTempoS,
  HandsObsRow,
} from "../../db";
import { formatDateTime, formatTempoS } from "./handsUtils";
import { extractLocalImagePath } from "./handsUtils";
import { openLocalImage } from "./openLocalImage";

export type ColumnId =
  | "time"
  | "hand"
  | "stackefectivo"
  | "p1bet"
  | "move"
  | "betmin"
  | "betmax"
  | "situacion"
  | "tempo";

export type ColumnDef = {
  id: ColumnId;
  label: string;
  sortableKey:
    | "detected_at_ms"
    | "hand"
    | "stackefectivo"
    | "p1bet"
    | "move"
    | "betmin"
    | "betmax"
    | "situacion"
    | "tempo";
  render: (row: HandsObsRow) => React.ReactNode;
};

export const HANDS_COLUMNS: ColumnDef[] = [
  {
    id: "time",
    label: "time",
    sortableKey: "detected_at_ms",
    render: (r) => formatDateTime(r.detected_at_ms),
  },
  {
    id: "hand",
    label: "hand",
    sortableKey: "hand",
    render: (r) => r.hand_class || r.mano_raw,
  },
  {
    id: "stackefectivo",
    label: "stackefectivo",
    sortableKey: "stackefectivo",
    render: (r) => {
      const v = extractStackEfectivo(r.ocr_json);
      const p = extractLocalImagePath(r);
      const canOpen = Boolean(p);
      return (
        <span
          style={{
            cursor: canOpen ? "pointer" : "default",
            textDecoration: canOpen ? "underline" : "none",
          }}
          title={canOpen ? p || "" : ""}
          onClick={(e) => {
            e.stopPropagation();
            if (p) openLocalImage(p);
          }}
        >
          {v ?? ""}
        </span>
      );
    },
  },
  {
    id: "p1bet",
    label: "p1bet",
    sortableKey: "p1bet",
    render: (r) => extractP1Bet(r.ocr_json) ?? "",
  },
  {
    id: "move",
    label: "move",
    sortableKey: "move",
    render: (r) => extractMove(r.ocr_json),
  },
  {
    id: "betmin",
    label: "betmin",
    sortableKey: "betmin",
    render: (r) => extractBetMin(r.ocr_json) ?? "",
  },
  {
    id: "betmax",
    label: "betmax",
    sortableKey: "betmax",
    render: (r) => extractBetMax(r.ocr_json) ?? "",
  },
  {
    id: "situacion",
    label: "situacion",
    sortableKey: "situacion",
    render: (r) => extractSituacion(r.ocr_json),
  },
  {
    id: "tempo",
    label: "TEMPO (s)",
    sortableKey: "tempo",
    render: (r) => formatTempoS(extractTempoS(r.ocr_json)),
  },
];
