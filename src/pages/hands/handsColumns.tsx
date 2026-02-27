/// C:\Users\Usuario\Desktop\proyectos\poker_boss\src\pages\hands\handsColumns.tsx
import React from "react";
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
import { extractLocalImagePath, formatDateTime, formatTempoS } from "./handsUtils";
import type { HandsSortKey } from "./sortHands";
function safeJson<T = any>(s?: string): T | null { try { return JSON.parse(s ?? "") as T; } catch { return null; } }

export type ColumnId =
  | "time"
  | "hand"
  | "stackef"
  | "p1bet"
  | "p2bet"
  | "p3bet"
  | "move"
  | "betmin"
  | "betmax"
  | "situacion"
  | "tempo"
  | "img";
export type ColumnDef = {
  id: ColumnId;
  label: string;
  sortableKey?: HandsSortKey;
  render: (row: HandsObsRow) => React.ReactNode;
};

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
  const obj = safeJson(ocr_json ?? "");
  if (!obj) return null;
  return pickBet(obj, "P2");
}

function extractP3BetLocal(ocr_json?: string): number | null {
  const obj = safeJson(ocr_json ?? "");
  if (!obj) return null;
  return pickBet(obj, "P3");
}

// ✅ factory para poder inyectar handler desde el componente (modal)
export function makeHandsColumns(onOpenImage: (path: string) => void): ColumnDef[] {
  return [
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
      id: "stackef",
      label: "stackef",
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
              if (p) onOpenImage(p);
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
      id: "p2bet",
      label: "p2bet",
      sortableKey: "p2bet",
      render: (r) => (r.p2bet ?? extractP2BetLocal(r.ocr_json)) ?? "",
    },
    {
      id: "p3bet",
      label: "p3bet",
      sortableKey: "p3bet",
      render: (r) => (r.p3bet ?? extractP3BetLocal(r.ocr_json)) ?? "",
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
    {
      id: "img",
      label: "IMG",
      render: (r) => {
        const p = extractLocalImagePath(r);
        if (!p) return "";
        return (
          <span
            style={{ cursor: "pointer", textDecoration: "underline" }}
            title={p}
            onClick={(e) => {
              e.stopPropagation();
              onOpenImage(p);
            }}
          >
            view
          </span>
        );
      },
    },
  ];
}



