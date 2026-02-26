/// C:\Users\Usuario\Desktop\proyectos\poker_boss\src\pages\hands\sortHands.ts
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

export type HandsSortKey =
  | "detected_at_ms"
  | "hand"
  | "stackefectivo"
  | "p1bet"
  | "move"
  | "betmin"
  | "betmax"
  | "situacion"
  | "tempo";

export function sortHands(rows: HandsObsRow[], key: HandsSortKey, asc: boolean) {
  const getVal = (row: any) => {
    switch (key) {
      case "hand":
        return row.hand_class || row.mano_raw;
      case "stackefectivo":
        return extractStackEfectivo(row.ocr_json);
      case "p1bet":
        return extractP1Bet(row.ocr_json);
      case "move":
        return extractMove(row.ocr_json);
      case "betmin":
        return extractBetMin(row.ocr_json);
      case "betmax":
        return extractBetMax(row.ocr_json);
      case "situacion":
        return extractSituacion(row.ocr_json);
      case "tempo":
        return extractTempoS(row.ocr_json);
      default:
        return row[key];
    }
  };

  return [...rows].sort((a: any, b: any) => {
    const va = getVal(a);
    const vb = getVal(b);

    if (va == null) return 1;
    if (vb == null) return -1;
    if (va === vb) return 0;

    if (asc) return va > vb ? 1 : -1;
    return va < vb ? 1 : -1;
  });
}
