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

// OPEN_PUSH se deriva automáticamente y NO se debe poder seleccionar en otras filas.
export const MOVES: OrMoveSelect[] = ["OR", "CALL", "RAISE", "FOLD", "LIMP"];

export function defaultPlan(): OrRangesPlan {
  return {
    OR_TO_CALL_ANY: { move: "OR", bet_min_bb: 0, bet_max_bb: 0 },
    OPEN_PUSH: { move: "OPEN_PUSH", bet_min_bb: 0, bet_max_bb: 0 },
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

/**
 * Antes: CALL/FOLD/LIMP forzaban bet_min/max (0/0 o 1/1).
 * Ahora: el usuario puede editar bet_min/max en cualquier move.
 * OPEN_PUSH sigue siendo derivado y se fuerza fuera de aquí.
 */
export function applyMoveRules(move: OrMoveSelect, row: OrRangesPlan[OrRangeKey]) {
  // OPEN_PUSH es derivado (se fuerza fuera), pero si llega aquí no rompemos:
  if (move === "OPEN_PUSH") return { ...row, move };

  // No forzar bet_min/max por move
  return { ...row, move };
}

/**
 * Antes: bloqueábamos inputs por move.
 * Ahora: no bloqueamos por move (el usuario quiere editar siempre).
 * OPEN_PUSH se bloquea/deriva a nivel de panel.
 */
export function isLockedRow(_move: OrMoveSelect): boolean {
  return false;
}
