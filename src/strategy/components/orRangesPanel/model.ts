/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\strategy\components\orRangesPanel\model.ts
 */
import type { OrRangesPlan, OrRangeKey, OrMoveSelect } from "../../types";

export const LABELS: Record<OrRangeKey, string> = {
  OR_TO_CALL_ANY: "OR to Call Any",
  OPEN_PUSH: "Open Push",
  OR_TO_CALL_SMALL: "OR to Call Small",
  OR_TO_FOLD: "OR to Fold",
};

export const MOVES: OrMoveSelect[] = ["OR", "CALL", "RAISE", "FOLD", "LIMP"];

export function defaultPlan(): OrRangesPlan {
  return {
    OR_TO_CALL_ANY: { move: "OR", bet_min_bb: 0, bet_max_bb: 0 },
    OPEN_PUSH: { move: "OR", bet_min_bb: 0, bet_max_bb: 0 },
    OR_TO_CALL_SMALL: { move: "OR", bet_min_bb: 0, bet_max_bb: 0 },
    OR_TO_FOLD: { move: "OR", bet_min_bb: 0, bet_max_bb: 0 },
  };
}

export function ensurePlan(p?: OrRangesPlan): OrRangesPlan {
  const base = defaultPlan();
  return { ...base, ...(p || {}) };
}

export function safeNum(v: string): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return n;
}

export function applyMoveRules(move: OrMoveSelect, row: OrRangesPlan[OrRangeKey]) {
  if (move === "FOLD") return { ...row, move, bet_min_bb: 0, bet_max_bb: 0 };
  if (move === "LIMP") return { ...row, move, bet_min_bb: 1, bet_max_bb: 1 };
  if (move === "CALL") return { ...row, move, bet_min_bb: 0, bet_max_bb: 0 };
  return { ...row, move };
}

export function isLockedRow(move: OrMoveSelect): boolean {
  return move === "FOLD" || move === "LIMP" || move === "CALL";
}
