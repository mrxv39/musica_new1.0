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
  // Migrate legacy or_ranges (array) if present
  if ((next as any).or_ranges && Array.isArray((next as any).or_ranges)) {
    // Not implemented: migration logic (if needed)
    // For now, ignore and use default
    delete (next as any).or_ranges;
  }

  const base = defaultOrRanges();
  next.orRanges = { ...base, ...(next.orRanges || {}) };
}
