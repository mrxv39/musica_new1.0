/// C:\Users\Usuario\Desktop\proyectos\poker_boss\src\pages\hands\handsFilters.ts
import type { HandsObsRow } from "../../db";
import { extractBetMax, extractBetMin, extractStackEfectivo } from "../../db";
import { validatePokerRangeList } from "../../strategy/pokerRange";

export type NumericRange = {
  min: number | null;
  max: number | null;
};

function asFiniteNumber(v: any): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const t = v.trim();
    if (!t) return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * Acepta:
 *  - "" => {min:null,max:null}
 *  - "20-75"
 *  - "20 - 75"
 *  - "20-" (solo min)
 *  - "-75" (solo max)
 *  - "20" (exacto => min=max=20)
 */
export function parseNumericRange(input: string): NumericRange {
  const raw = String(input || "").trim();
  if (!raw) return { min: null, max: null };

  // exacto: "20"
  if (!raw.includes("-")) {
    const n = asFiniteNumber(raw);
    if (n === null) return { min: null, max: null };
    return { min: n, max: n };
  }

  // rango: "a-b" (a o b pueden estar vacíos)
  const parts = raw.split("-");
  const left = (parts[0] ?? "").trim();
  const right = (parts.slice(1).join("-") ?? "").trim();

  const min = left ? asFiniteNumber(left) : null;
  const max = right ? asFiniteNumber(right) : null;

  // si ambos existen y están invertidos, normaliza
  if (min !== null && max !== null && min > max) return { min: max, max: min };

  return { min, max };
}

export function inRange(v: number, r: NumericRange): boolean {
  if (r.min !== null && v < r.min) return false;
  if (r.max !== null && v > r.max) return false;
  return true;
}

// =========================
// Poker range matching (AA, AKo, AKs, y rangos "A9o-A2o", "33-22", etc)
// =========================
const RANKS = ["A", "K", "Q", "J", "T", "9", "8", "7", "6", "5", "4", "3", "2"] as const;
type Rank = (typeof RANKS)[number];

function rankIndex(r: string): number {
  return RANKS.indexOf(r as Rank);
}
function isRank(r: string): r is Rank {
  return rankIndex(r) >= 0;
}

function normRank(r: string): Rank | null {
  const up = (r ?? "").toUpperCase();
  if (up === "10") return "T";
  if (isRank(up)) return up;
  return null;
}

/** Convierte "AhKd" / "AsKs" / "10h9h" => "AKO" / "AKS" / "T9S" */
export function classifyHand(manoRaw?: string): string | null {
  const s = String(manoRaw || "").trim();
  if (!s) return null;

  const m = s.match(/^([2-9TJQKA]|10)([shdcSHDC])([2-9TJQKA]|10)([shdcSHDC])/);
  if (!m) return null;

  const r1 = normRank(m[1]);
  const r2 = normRank(m[3]);
  const su1 = (m[2] || "").toUpperCase();
  const su2 = (m[4] || "").toUpperCase();
  if (!r1 || !r2) return null;

  // order hi->lo
  const i1 = rankIndex(r1);
  const i2 = rankIndex(r2);
  if (i1 < 0 || i2 < 0) return null;

  let hi = r1;
  let lo = r2;
  if (i1 > i2) {
    // r1 es más bajo que r2
    hi = r2;
    lo = r1;
  }

  if (hi === lo) return `${hi}${lo}`; // pair

  const sfx = su1 === su2 ? "S" : "O";
  return `${hi}${lo}${sfx}`;
}

type RangeToken =
  | { kind: "pair"; a: Rank; b: Rank } // "AA"
  | { kind: "suited"; hi: Rank; lo: Rank; sfx: "S" | "O" }; // "AKS"/"AKO"

function parseToken(tok: string): RangeToken | null {
  const t = (tok ?? "").trim().toUpperCase();
  if (!t) return null;

  // pair: "AA"
  if (t.length === 2) {
    const a = t[0];
    const b = t[1];
    if (!isRank(a) || !isRank(b)) return null;
    if (a !== b) return null;
    return { kind: "pair", a: a as Rank, b: b as Rank };
  }

  // suited/offsuit: "AKS"/"AKO"
  if (t.length === 3) {
    const hi = t[0];
    const lo = t[1];
    const sfx = t[2];
    if (!isRank(hi) || !isRank(lo)) return null;
    if (hi === lo) return null;
    if (sfx !== "S" && sfx !== "O") return null;

    // must be ordered hi >= lo (A..2)
    const i1 = rankIndex(hi);
    const i2 = rankIndex(lo);
    if (i1 < 0 || i2 < 0) return null;
    if (i1 > i2) return null;

    return { kind: "suited", hi: hi as Rank, lo: lo as Rank, sfx: sfx as "S" | "O" };
  }

  return null;
}

function matchTokenExact(hand: string, tok: RangeToken): boolean {
  const h = (hand ?? "").trim().toUpperCase();
  if (!h) return false;

  if (tok.kind === "pair") return h === `${tok.a}${tok.b}`;
  return h === `${tok.hi}${tok.lo}${tok.sfx}`;
}

function matchTokenRange(hand: string, lhs: RangeToken, rhs: RangeToken): boolean {
  const h = (hand ?? "").trim().toUpperCase();
  if (!h) return false;

  // pair range: "AA-TT"
  if (lhs.kind === "pair" && rhs.kind === "pair") {
    if (h.length !== 2) return false;
    const a = h[0];
    const b = h[1];
    if (a !== b) return false;
    if (!isRank(a)) return false;

    const ih = rankIndex(a);
    const il = rankIndex(lhs.a);
    const ir = rankIndex(rhs.a);
    if (ih < 0 || il < 0 || ir < 0) return false;

    // lhs es más alto o igual que rhs (descendente)
    // match: rhs <= hand <= lhs  (en indices: il <= ih <= ir ? NO, ojo: A=0 ... 2=12)
    // como A es 0 y 2 es 12, "más alto" => índice menor
    // AA-TT => lhs=0 rhs=4 -> válido si ih entre 0..4
    const min = Math.min(il, ir);
    const max = Math.max(il, ir);
    return ih >= min && ih <= max;
  }

  // suited/offsuit range: "A9O-A2O" (misma primera carta y mismo sufijo)
  if (lhs.kind === "suited" && rhs.kind === "suited") {
    if (lhs.hi !== rhs.hi) return false;
    if (lhs.sfx !== rhs.sfx) return false;

    // hand debe ser suited/offsuit con misma hi
    if (h.length !== 3) return false;
    const hi = h[0];
    const lo = h[1];
    const sfx = h[2];
    if (!isRank(hi) || !isRank(lo)) return false;
    if (hi !== lhs.hi) return false;
    if (sfx !== lhs.sfx) return false;

    const ihLo = rankIndex(lo);
    const il = rankIndex(lhs.lo);
    const ir = rankIndex(rhs.lo);
    if (ihLo < 0 || il < 0 || ir < 0) return false;

    const min = Math.min(il, ir);
    const max = Math.max(il, ir);
    return ihLo >= min && ihLo <= max;
  }

  return false;
}

export function matchesPokerRangeList(handClass: string | null, input: string): { ok: true; match: boolean } | { ok: false; match: boolean; error: string } {
  const s = String(input || "").trim();
  if (!s) return { ok: true, match: true }; // filtro vacío => no filtra

  const vr = validatePokerRangeList(s);
  if (!vr.ok) return { ok: false, match: false, error: vr.error };

  const h = (handClass ?? "").trim().toUpperCase();
  if (!h) return { ok: true, match: false };

  const items = s
    .split(",")
    .map((x) => (x ?? "").trim().toUpperCase())
    .filter(Boolean);

  for (const it of items) {
    const parts = it.split("-");
    if (parts.length === 1) {
      const tok = parseToken(parts[0]);
      if (tok && matchTokenExact(h, tok)) return { ok: true, match: true };
      continue;
    }

    if (parts.length === 2) {
      const lhs = parseToken(parts[0]);
      const rhs = parseToken(parts[1]);
      if (!lhs || !rhs) continue;
      if (matchTokenRange(h, lhs, rhs)) return { ok: true, match: true };
      continue;
    }
  }

  return { ok: true, match: false };
}

// =========================
// Main filter (AND dependiente entre todos)
// =========================
export function filterHandsByAllFilters(
  rows: HandsObsRow[],
  stackEfRange: NumericRange,
  betRange: NumericRange,
  rangeListText: string
): { rows: HandsObsRow[]; rangeError: string } {
  const stackActive = stackEfRange.min !== null || stackEfRange.max !== null;
  const betActive = betRange.min !== null || betRange.max !== null;
  const rangeActive = String(rangeListText || "").trim().length > 0;

  if (!stackActive && !betActive && !rangeActive) return { rows, rangeError: "" };

  let rangeError = "";

  const out = rows.filter((r) => {
    if (stackActive) {
      const se = extractStackEfectivo(r.ocr_json);
      if (se === null) return false;
      if (!inRange(se, stackEfRange)) return false;
    }

    if (betActive) {
      const bmin = extractBetMin(r.ocr_json);
      const bmax = extractBetMax(r.ocr_json);
      if (bmin === null || bmax === null) return false;
      if (!inRange(bmin, betRange)) return false;
      if (!inRange(bmax, betRange)) return false;
    }

    if (rangeActive) {
      const hc = (r.hand_class || classifyHand(r.mano_raw) || "").toUpperCase() || null;
      const m = matchesPokerRangeList(hc, rangeListText);
      if (!m.ok) {
        rangeError = m.error;
        return false; // si el rango es inválido, no match de ninguna fila
      }
      if (!m.match) return false;
    }

    return true;
  });

  return { rows: out, rangeError };
}
