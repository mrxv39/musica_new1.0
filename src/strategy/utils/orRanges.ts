/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\strategy\utils\orRanges.ts
 */
import type { OrRanges, SubStrategyPayload } from "../types";

export function defaultOrRanges(): OrRanges {
  return {
    OR_TO_CALL_ANY: "",
    OPEN_PUSH: "",
    OR_TO_CALL_SMALL: "",
    OR_TO_FOLD: "",
  };
}

export function ensureOrRanges(next: SubStrategyPayload): void {
  // If orRanges is missing but or_ranges array exists, reconstruct orRanges from it
  if (!next.orRanges && Array.isArray((next as any).or_ranges)) {
    const arr = (next as any).or_ranges as any[];
    const obj: OrRanges = {
      OR_TO_CALL_ANY: "",
      OPEN_PUSH: "",
      OR_TO_CALL_SMALL: "",
      OR_TO_FOLD: "",
    };
    for (const row of arr) {
      if (row && typeof row.id === "string" && typeof row.range === "string") {
        if (obj.hasOwnProperty(row.id)) {
          obj[row.id as keyof OrRanges] = row.range;
        }
      }
    }
    next.orRanges = obj;
  }

  const base = defaultOrRanges();
  next.orRanges = { ...base, ...(next.orRanges || {}) };
}
