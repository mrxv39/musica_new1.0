/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\strategy\utils\orRangesPlan.ts
 */
import type { OrRangesPlan, SubStrategyPayload } from "../types";
import { coerceMinMax } from "./numeric";

export function defaultOrRangesPlan(): OrRangesPlan {
  return {
    OR_TO_CALL_ANY: { move: "OR", bet_min_bb: 0, bet_max_bb: 0 },
    OPEN_PUSH: { move: "OPEN_PUSH", bet_min_bb: 0, bet_max_bb: 0 },
    OR_TO_CALL_SMALL: { move: "OR", bet_min_bb: 0, bet_max_bb: 0 },
    OR_TO_FOLD: { move: "OR", bet_min_bb: 0, bet_max_bb: 0 },
  };
}

export function ensureOrRangesPlan(next: SubStrategyPayload): void {
  const base = defaultOrRangesPlan();
  next.orRangesPlan = { ...base, ...(next.orRangesPlan || {}) };

  // Regla que mantenemos: OPEN_PUSH derivado de stack P1
  // El resto: no se fuerzan bet_min/max por move, solo se normaliza min<=max y step.
  for (const k of Object.keys(base) as (keyof OrRangesPlan)[]) {
    const row = next.orRangesPlan[k];

    if (k === "OPEN_PUSH") {
      row.move = "OPEN_PUSH";
      row.bet_min_bb = next.p1_stack_min;
      row.bet_max_bb = next.p1_stack_max;
      continue;
    }

    const mm = coerceMinMax(row.bet_min_bb, row.bet_max_bb, {
      min: 0,
      max: 9999,
      step: 0.5,
    });
    row.bet_min_bb = mm.min;
    row.bet_max_bb = mm.max;
  }
}
