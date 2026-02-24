/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\pages\strategy\orRangesAdapter.ts
 *
 * Adapter puro para mantener una sola fuente de verdad:
 * - payload.orRanges (strings)
 * - payload.orRangesPlan (move + bet_min/max)
 * - UI rows (OrRangeRow[])
 */
import type { OrRanges, OrRangeRow, OrRangesPlan } from "../../strategy/types";

export const OR_KEYS = ["OR_TO_CALL_ANY", "OPEN_PUSH", "OR_TO_CALL_SMALL", "OR_TO_FOLD"] as const;
export type OrKey = (typeof OR_KEYS)[number];

export function emptyOrRanges(): OrRanges {
  return {
    OR_TO_CALL_ANY: "",
    OPEN_PUSH: "",
    OR_TO_CALL_SMALL: "",
    OR_TO_FOLD: "",
  };
}

export function emptyOrRangesPlan(): OrRangesPlan {
  const plan: any = {};
  for (const k of OR_KEYS) {
    plan[k] = { move: "OR", bet_min_bb: 0, bet_max_bb: 0 };
  }
  return plan as OrRangesPlan;
}

export function coerceOrRangesPlan(input: any): OrRangesPlan {
  const base = emptyOrRangesPlan() as any;
  const obj = input && typeof input === "object" ? input : {};
  const out: any = {};
  for (const k of OR_KEYS) {
    const p = obj[k] && typeof obj[k] === "object" ? obj[k] : {};
    out[k] = {
      move: typeof p.move === "string" ? p.move : base[k].move,
      bet_min_bb: Number.isFinite(Number(p.bet_min_bb)) ? Number(p.bet_min_bb) : base[k].bet_min_bb,
      bet_max_bb: Number.isFinite(Number(p.bet_max_bb)) ? Number(p.bet_max_bb) : base[k].bet_max_bb,
    };
  }
  return out as OrRangesPlan;
}

export function buildRows(orRanges?: OrRanges, plan?: OrRangesPlan): OrRangeRow[] {
  const flat = { ...emptyOrRanges(), ...(orRanges ?? {}) };
  const p = plan ? coerceOrRangesPlan(plan) : emptyOrRangesPlan();

  return (Object.keys(flat) as (keyof OrRanges)[]).map((key) => {
    const pp: any = (p as any)[key];
    return {
      id: key as any,
      label: key as any,
      mode: pp?.move || "OR",
      bet_min: pp?.bet_min_bb ?? 0,
      bet_max: pp?.bet_max_bb ?? 0,
      range: flat[key] ?? "",
    };
  });
}

export function rowsToOrRanges(rows: OrRangeRow[] | undefined): OrRanges {
  const base = emptyOrRanges();
  if (!Array.isArray(rows)) return base;

  const out: any = { ...base };
  for (const r of rows) {
    const id = String((r as any)?.id ?? "");
    if (Object.prototype.hasOwnProperty.call(out, id)) {
      const val = (r as any)?.range;
      out[id] = typeof val === "string" ? val : String(val ?? "");
    }
  }
  return out as OrRanges;
}

export function rowsToOrRangesPlan(rows: OrRangeRow[] | undefined): OrRangesPlan {
  const base = emptyOrRangesPlan() as any;
  if (!Array.isArray(rows)) return base as OrRangesPlan;

  const out: any = {};
  for (const k of OR_KEYS) out[k] = { ...base[k] };

  for (const r of rows) {
    const id = String((r as any)?.id ?? "");
    if (Object.prototype.hasOwnProperty.call(out, id)) {
      out[id] = {
        move: typeof (r as any)?.mode === "string" ? (r as any).mode : out[id].move,
        bet_min_bb: Number.isFinite(Number((r as any)?.bet_min)) ? Number((r as any).bet_min) : out[id].bet_min_bb,
        bet_max_bb: Number.isFinite(Number((r as any)?.bet_max)) ? Number((r as any).bet_max) : out[id].bet_max_bb,
      };
    }
  }
  return out as OrRangesPlan;
}

export function isSameOrRanges(a?: OrRanges, b?: OrRanges): boolean {
  const aa = a ?? emptyOrRanges();
  const bb = b ?? emptyOrRanges();
  for (const k of OR_KEYS) {
    if (String((aa as any)[k] ?? "") !== String((bb as any)[k] ?? "")) return false;
  }
  return true;
}

export function isSameRows(a?: OrRangeRow[], b?: OrRangeRow[]): boolean {
  if (!Array.isArray(a) && !Array.isArray(b)) return true;
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x: any = a[i];
    const y: any = b[i];
    if (String(x?.id) !== String(y?.id)) return false;
    if (String(x?.range ?? "") !== String(y?.range ?? "")) return false;
    if (String(x?.mode ?? "") !== String(y?.mode ?? "")) return false;
    if (Number(x?.bet_min ?? 0) !== Number(y?.bet_min ?? 0)) return false;
    if (Number(x?.bet_max ?? 0) !== Number(y?.bet_max ?? 0)) return false;
  }
  return true;
}
