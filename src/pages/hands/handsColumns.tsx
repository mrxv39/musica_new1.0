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

function safeJson<T = any>(s?: string): T | null {
  try {
    return JSON.parse(s ?? "") as T;
  } catch {
    return null;
  }
}

export type ColumnId = string;

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

function truncateText(s: string, max = 80) {
  const t = (s || "").replace(/\s+/g, " ").trim();
  if (!t) return "";
  return t.length > max ? t.slice(0, max) + " …" : t;
}

function renderAny(v: any) {
  if (v === null || v === undefined) return "";
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (typeof v === "string") return v;
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function makeRawColumn(key: string): ColumnDef {
  return {
    id: key,
    label: key,
    render: (r) => {
      const v = (r as any)?.[key];
      const s = renderAny(v);
      if (!s) return "";
      const t = truncateText(s, 90);
      const isLong = t !== s;
      return (
        <span title={isLong ? s : ""} style={{ display: "inline-block", maxWidth: 420, overflow: "hidden" }}>
          {t}
        </span>
      );
    },
  };
}

// ✅ factory: columns base + columns dinámicas (todas las keys del row)
export function makeHandsColumns(
  onOpenImage: (path: string, row: HandsObsRow) => void,
  sampleRow?: HandsObsRow | null
): ColumnDef[] {
  const base: ColumnDef[] = [
    {
      id: "time",
      label: "time",
      sortableKey: "detected_at_ms",
      render: (r) => formatDateTime((r as any).detected_at_ms),
    },
    {
      id: "hand",
      label: "hand",
      sortableKey: "hand",
      render: (r) => (r as any).hand_class || (r as any).mano_raw || "",
    },
    {
      id: "stackef",
      label: "stackef",
      sortableKey: "stackefectivo",
      render: (r) => {
        const v = extractStackEfectivo((r as any).ocr_json);
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
              if (p) onOpenImage(p, r);
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
      render: (r) => extractP1Bet((r as any).ocr_json) ?? "",
    },
    {
      id: "p2bet",
      label: "p2bet",
      sortableKey: "p2bet",
      render: (r) => ((r as any).p2bet ?? extractP2BetLocal((r as any).ocr_json)) ?? "",
    },
    {
      id: "p3bet",
      label: "p3bet",
      sortableKey: "p3bet",
      render: (r) => ((r as any).p3bet ?? extractP3BetLocal((r as any).ocr_json)) ?? "",
    },
    {
      id: "move",
      label: "move",
      sortableKey: "move",
      render: (r) => extractMove((r as any).ocr_json),
    },
    {
      id: "betmin",
      label: "betmin",
      sortableKey: "betmin",
      render: (r) => extractBetMin((r as any).ocr_json) ?? "",
    },
    {
      id: "betmax",
      label: "betmax",
      sortableKey: "betmax",
      render: (r) => extractBetMax((r as any).ocr_json) ?? "",
    },
    {
      id: "situacion",
      label: "situacion",
      sortableKey: "situacion",
      render: (r) => extractSituacion((r as any).ocr_json),
    },
    {
      id: "tempo",
      label: "TEMPO (s)",
      sortableKey: "tempo",
      render: (r) => formatTempoS(extractTempoS((r as any).ocr_json)),
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
              onOpenImage(p, r);
            }}
          >
            view
          </span>
        );
      },
    },
  ];

  const sample = sampleRow ?? null;
  if (!sample) return base;

  const baseIds = new Set(base.map((c) => c.id));
  const keys = Object.keys(sample as any);

  const extra = keys
    .filter((k) => !baseIds.has(k))
    .sort((a, b) => a.localeCompare(b))
    .map((k) => makeRawColumn(k));

  return base.concat(extra);
}
