/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\strategy\utils\orRanges.ts
 */
import type { OrRanges, OrRangesPlan, OrRangeRow, SubStrategyPayload } from "../types";

export function defaultOrRanges(): OrRanges {
  return {
    OR_TO_CALL_ANY: "",
    OPEN_PUSH: "",
    OR_TO_CALL_SMALL: "",
    OR_TO_FOLD: "",
  };
}

function defaultOrRangesPlan(): OrRangesPlan {
  return {
    OR_TO_CALL_ANY: { move: "OR", bet_min_bb: 0, bet_max_bb: 0 },
    OPEN_PUSH: { move: "OPEN_PUSH", bet_min_bb: 0, bet_max_bb: 0 },
    OR_TO_CALL_SMALL: { move: "OR", bet_min_bb: 0, bet_max_bb: 0 },
    OR_TO_FOLD: { move: "OR", bet_min_bb: 0, bet_max_bb: 0 },
  };
}

function coerceOrRangesPlan(input: any): OrRangesPlan {
  const base = defaultOrRangesPlan() as any;
  const obj = input && typeof input === "object" ? input : {};
  const out: any = {};
  for (const k of Object.keys(base)) {
    const p = obj[k] && typeof obj[k] === "object" ? obj[k] : {};
    out[k] = {
      move: typeof p.move === "string" ? p.move : base[k].move,
      bet_min_bb: Number.isFinite(Number(p.bet_min_bb)) ? Number(p.bet_min_bb) : base[k].bet_min_bb,
      bet_max_bb: Number.isFinite(Number(p.bet_max_bb)) ? Number(p.bet_max_bb) : base[k].bet_max_bb,
    };
  }
  return out as OrRangesPlan;
}

/**
 * ✅ Contract export:
 * src/strategy/utils/orRanges.ts debe exportar buildRows
 */
export function buildRows(orRanges?: OrRanges, plan?: OrRangesPlan): OrRangeRow[] {
  const flat = { ...defaultOrRanges(), ...(orRanges ?? {}) };
  const p = plan ? coerceOrRangesPlan(plan) : defaultOrRangesPlan();

  return (Object.keys(flat) as (keyof OrRanges)[]).map((key) => {
    const pp: any = (p as any)[key];
    return {
      id: String(key),
      label: String(key),
      mode: String(pp?.move ?? "OR"),
      bet_min: Number(pp?.bet_min_bb ?? 0),
      bet_max: Number(pp?.bet_max_bb ?? 0),
      range: String((flat as any)[key] ?? ""),
    };
  });
}

export function ensureOrRanges(next: SubStrategyPayload): void {
  // If orRanges is missing but or_ranges array exists, reconstruct orRanges from it
  if (!next.orRanges && Array.isArray((next as any).or_ranges)) {
    const arr = (next as any).or_ranges as any[];
    const obj: OrRanges = defaultOrRanges();
    for (const row of arr) {
      if (row && typeof row.id === "string" && typeof row.range === "string") {
        if (Object.prototype.hasOwnProperty.call(obj, row.id)) {
          (obj as any)[row.id] = row.range;
        }
      }
    }
    next.orRanges = obj;
  }

  const base = defaultOrRanges();
  next.orRanges = { ...base, ...(next.orRanges || {}) };
}
