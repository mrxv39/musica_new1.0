/// C:\Users\Usuario\Desktop\proyectos\poker_boss\src\pages\hands\handsFilters.ts
import type { HandsObsRow } from "../../db";
import { extractBetMax, extractBetMin, extractStackEfectivo } from "../../db";

export type NumericRange = { min: number; max: number };
export type LinkFilter = "all" | "linked" | "unlinked";

export function parseNumericRange(text: string): NumericRange | null {
  const t = String(text || "").trim();
  if (!t) return null;

  // Si contiene "-", debe ser exactamente "a-b" con ambos lados presentes
  if (t.includes("-")) {
    const raw = t.split("-");
    if (raw.length !== 2) return null;

    const left = raw[0].trim();
    const right = raw[1].trim();
    if (!left || !right) return null;

    const a = Number(left);
    const b = Number(right);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return null;

    const min = Math.min(a, b);
    const max = Math.max(a, b);
    return { min, max };
  }

  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  return { min: n, max: n };
}

function inRange(n: number | null, r: NumericRange | null): boolean {
  if (!r) return true;
  if (n === null) return false;
  return n >= r.min && n <= r.max;
}

/**
 * Convierte "AhKd" -> "AKO", "AhKh" -> "AKS", "TdTs" -> "TT"
 * Devuelve null si mano_raw es inválida.
 */
export function classifyHand(manoRaw?: string): string | null {
  const s = String(manoRaw || "").trim();
  if (!s) return null;

  const m = s.match(/^([2-9TJQKA])([cdhs])([2-9TJQKA])([cdhs])$/i);
  if (!m) return null;

  const r1 = m[1].toUpperCase();
  const su1 = m[2].toLowerCase();
  const r2 = m[3].toUpperCase();
  const su2 = m[4].toLowerCase();

  if (r1 === r2) return `${r1}${r2}`;

  const a = normalizeRank(r1);
  const b = normalizeRank(r2);
  const hi = a.idx >= b.idx ? a.r : b.r;
  const lo = a.idx >= b.idx ? b.r : a.r;

  const suited = su1 === su2;
  return `${hi}${lo}${suited ? "S" : "O"}`;
}

type NormRank = { r: string; idx: number };
function normalizeRank(r: string): NormRank {
  const R = r.toUpperCase();
  const order = "23456789TJQKA";
  const idx = order.indexOf(R);
  return { r: R, idx: idx < 0 ? -1 : idx };
}

type CompileOk = { ok: true; match: (handClass: string) => boolean };
type CompileBad = { ok: false; error: string };
type CompileResult = CompileOk | CompileBad;

type RangeToken =
  | { kind: "exact"; value: string }
  | { kind: "pairRange"; hi: string; lo: string }
  | { kind: "nonPairRange"; hi: string; lo: string; suited: "S" | "O" };

function parseExactToken(tok: string): RangeToken | null {
  if (/^[2-9TJQKA]{2}$/.test(tok)) return { kind: "exact", value: tok };

  const m = tok.match(/^([2-9TJQKA])([2-9TJQKA])([SO])$/);
  if (!m) return null;

  const r1 = normalizeRank(m[1]).r;
  const r2 = normalizeRank(m[2]).r;

  if (r1 === r2) return { kind: "exact", value: `${r1}${r2}` };

  const a = normalizeRank(r1);
  const b = normalizeRank(r2);
  const hi = a.idx >= b.idx ? a.r : b.r;
  const lo = a.idx >= b.idx ? b.r : a.r;

  return { kind: "exact", value: `${hi}${lo}${m[3]}` };
}

function parseRangeToken(tok: string): RangeToken | null {
  const parts = tok.split("-").map((s) => s.trim()).filter(Boolean);
  if (parts.length !== 2) return null;

  const a = parseExactToken(parts[0]);
  const b = parseExactToken(parts[1]);
  if (!a || !b) return null;

  // pair range: "33-22"
  if (
    a.kind === "exact" &&
    b.kind === "exact" &&
    /^[2-9TJQKA]{2}$/.test(a.value) &&
    /^[2-9TJQKA]{2}$/.test(b.value)
  ) {
    return { kind: "pairRange", hi: a.value, lo: b.value };
  }

  // non-pair range: "A9O-A2O" / "K9S-K2S"
  if (
    a.kind === "exact" &&
    b.kind === "exact" &&
    /^[2-9TJQKA]{2}[SO]$/.test(a.value) &&
    /^[2-9TJQKA]{2}[SO]$/.test(b.value)
  ) {
    const suitedA = a.value.slice(2) as "S" | "O";
    const suitedB = b.value.slice(2) as "S" | "O";
    if (suitedA !== suitedB) return null;
    return { kind: "nonPairRange", hi: a.value, lo: b.value, suited: suitedA };
  }

  return null;
}

function pairBetween(h: string, a: string, b: string): boolean {
  const idxH = normalizeRank(h[0]).idx;
  const idxA = normalizeRank(a[0]).idx;
  const idxB = normalizeRank(b[0]).idx;
  if (idxH < 0 || idxA < 0 || idxB < 0) return false;

  const hi = Math.max(idxA, idxB);
  const lo = Math.min(idxA, idxB);
  return idxH >= lo && idxH <= hi;
}

function nonPairBetween(h: string, a: string, b: string): boolean {
  const hHi = normalizeRank(h[0]).idx;
  const hLo = normalizeRank(h[1]).idx;

  const aHi = normalizeRank(a[0]).idx;
  const aLo = normalizeRank(a[1]).idx;

  const bHi = normalizeRank(b[0]).idx;
  const bLo = normalizeRank(b[1]).idx;

  if (hHi < 0 || hLo < 0 || aHi < 0 || aLo < 0 || bHi < 0 || bLo < 0) return false;

  // exige mismo high rank (A9O-A2O, KJo-K8o, etc.)
  if (hHi !== aHi || aHi !== bHi) return false;

  const hi = Math.max(aLo, bLo);
  const lo = Math.min(aLo, bLo);
  return hLo >= lo && hLo <= hi;
}

function compileRangeListNoCache(text: string): CompileResult {
  const t = String(text || "").trim();
  if (!t) return { ok: true, match: () => true };

  const rawTokens = t
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

  if (rawTokens.length === 0) return { ok: true, match: () => true };

  const tokens: RangeToken[] = [];
  for (const rt of rawTokens) {
    const tok = rt.toUpperCase().replace(/[^2-9TJQKASO\-]/g, "");
    if (!tok) continue;

    const r = tok.includes("-") ? parseRangeToken(tok) : parseExactToken(tok);
    if (!r) return { ok: false, error: `token inválido: '${rt}'` };
    tokens.push(r);
  }

  const match = (handClass: string): boolean => {
    const hc = String(handClass || "").trim().toUpperCase();
    if (!hc) return false;

    for (const tkn of tokens) {
      if (tkn.kind === "exact") {
        if (hc === tkn.value) return true;
        continue;
      }

      if (tkn.kind === "pairRange") {
        if (!/^[2-9TJQKA]{2}$/.test(hc)) continue;
        if (pairBetween(hc, tkn.hi, tkn.lo)) return true;
        continue;
      }

      if (!/^[2-9TJQKA]{2}[SO]$/.test(hc)) continue;
      if (hc.slice(2) !== tkn.suited) continue;
      if (nonPairBetween(hc, tkn.hi, tkn.lo)) return true;
    }
    return false;
  };

  return { ok: true, match };
}

// Cache LRU simple (evita recompilar en loops grandes)
const RANGE_CACHE_MAX = 32;
const rangeCache = new Map<string, CompileResult>();

function compileRangeList(text: string): CompileResult {
  const key = String(text || "").trim();
  if (!key) return { ok: true, match: () => true };

  const hit = rangeCache.get(key);
  if (hit) {
    // refresh LRU
    rangeCache.delete(key);
    rangeCache.set(key, hit);
    return hit;
  }

  const compiled = compileRangeListNoCache(key);
  rangeCache.set(key, compiled);

  if (rangeCache.size > RANGE_CACHE_MAX) {
    const firstKey = rangeCache.keys().next().value as string | undefined;
    if (firstKey) rangeCache.delete(firstKey);
  }

  return compiled;
}

export function matchesPokerRangeList(
  handClass: string,
  rangeListText: string
): { ok: boolean; match: boolean; error?: string } {
  const c = compileRangeList(rangeListText);
  if (!c.ok) return { ok: false, match: false, error: c.error };
  return { ok: true, match: c.match(handClass) };
}

export function filterHandsByAllFilters(
  rows: HandsObsRow[],
  stackEfRange: NumericRange | null,
  betRange: NumericRange | null,
  rangeListText: string,
  linkFilter: LinkFilter = "all"
): { rows: HandsObsRow[]; rangeError?: string } {
  const hasRangeFilter = String(rangeListText || "").trim().length > 0;
  const compiled = hasRangeFilter ? compileRangeList(rangeListText) : ({ ok: true, match: () => true } as CompileOk);

  const out: HandsObsRow[] = [];
  for (const r of rows || []) {
    if (linkFilter === "linked" && !r.linked_gamecode) continue;
    if (linkFilter === "unlinked" && r.linked_gamecode) continue;

    const se = extractStackEfectivo(r.ocr_json);
    if (!inRange(se, stackEfRange)) continue;

    if (betRange) {
      const bmin = extractBetMin(r.ocr_json);
      const bmax = extractBetMax(r.ocr_json);
      if (!inRange(bmin, betRange)) continue;
      if (!inRange(bmax, betRange)) continue;
    }

    if (hasRangeFilter) {
      if (!compiled.ok) {
        // rango inválido: no filtramos por rango, pero devolvemos error (UX)
      } else {
        const hc = (r.hand_class && String(r.hand_class).trim()) || classifyHand(r.mano_raw || "") || "";
        if (!compiled.match(hc)) continue;
      }
    }

    out.push(r);
  }

  return compiled.ok ? { rows: out } : { rows: out, rangeError: compiled.error };
}
