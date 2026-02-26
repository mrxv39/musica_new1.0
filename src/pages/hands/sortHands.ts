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
import { safeJson } from "./handsUtils";

export type HandsSortKey =
  | "detected_at_ms"
  | "hand"
  | "stackefectivo"
  | "p1bet"
  | "p2bet"
  | "p3bet"
  | "move"
  | "betmin"
  | "betmax"
  | "situacion"
  | "tempo";

function pickBet(obj: any, player: "P2" | "P3"): number | null {
  const v =
    obj?.bets?.[player] ??
    obj?.ocr?.bets?.[player] ??
    obj?.ocr?.[player]?.bet ??
    obj?.[player]?.bet ??
    null;

  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function extractP2BetLocal(ocr_json?: string): number | null {
  const obj = safeJson(ocr_json);
  if (!obj) return null;
  return pickBet(obj, "P2");
}

function extractP3BetLocal(ocr_json?: string): number | null {
  const obj = safeJson(ocr_json);
  if (!obj) return null;
  return pickBet(obj, "P3");
}

export function sortHands(rows: HandsObsRow[], key: HandsSortKey, asc: boolean) {
  const getVal = (row: any) => {
    switch (key) {
      case "hand":
        return row.hand_class || row.mano_raw;
      case "stackefectivo":
        return extractStackEfectivo(row.ocr_json);
      case "p1bet":
        return extractP1Bet(row.ocr_json);
      case "p2bet":
        return extractP2BetLocal(row.ocr_json);
      case "p3bet":
        return extractP3BetLocal(row.ocr_json);
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
