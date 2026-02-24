/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\strategy\utils\payload.ts
 */
import type { SubStrategyPayload } from "../types";
import { isFiniteNum, coerceMinMax } from "./numeric";
import { computeSituacionFromPositions } from "./situation";
import { ensureOrRanges } from "./orRanges";
import { ensureOrRangesPlan } from "./orRangesPlan";

/**
 * Normaliza el payload con reglas:
 * - números finitos
 * - min<=max
 * - clamp bounds
 * - step 0.5
 */
export function normalizePayload(p: SubStrategyPayload): SubStrategyPayload {
  const next: SubStrategyPayload = { ...p };

  // ---- P1 ----
  const p1bet = coerceMinMax(next.p1_bet_min, next.p1_bet_max, { min: 0, max: 9999, step: 0.5 });
  next.p1_bet_min = p1bet.min;
  next.p1_bet_max = p1bet.max;

  const p1st = coerceMinMax(next.p1_stack_min, next.p1_stack_max, { min: 0, max: 9999, step: 0.5 });
  next.p1_stack_min = p1st.min;
  next.p1_stack_max = p1st.max;

  const p1se = coerceMinMax(next.p1_se_min, next.p1_se_max, { min: 0, max: 9999, step: 0.5 });
  next.p1_se_min = p1se.min;
  next.p1_se_max = p1se.max;

  // ---- P2 ----
  const p2bet = coerceMinMax(next.p2_bet_min, next.p2_bet_max, { min: 0, max: 9999, step: 0.5 });
  next.p2_bet_min = p2bet.min;
  next.p2_bet_max = p2bet.max;

  const p2st = coerceMinMax(next.p2_stack_min, next.p2_stack_max, { min: 0, max: 9999, step: 0.5 });
  next.p2_stack_min = p2st.min;
  next.p2_stack_max = p2st.max;

  // ---- P3 ----
  const p3bet = coerceMinMax(next.p3_bet_min, next.p3_bet_max, { min: 0, max: 9999, step: 0.5 });
  next.p3_bet_min = p3bet.min;
  next.p3_bet_max = p3bet.max;

  const p3st = coerceMinMax(next.p3_stack_min, next.p3_stack_max, { min: 0, max: 9999, step: 0.5 });
  next.p3_stack_min = p3st.min;
  next.p3_stack_max = p3st.max;

  // situacion siempre derivada de posiciones
  next.situacion = computeSituacionFromPositions(next.hero_pos, next.p2_pos, next.p3_pos);

  // fallback defensivo (mantengo tus checks originales)
  if (!isFiniteNum(next.p1_bet_min)) next.p1_bet_min = 0;
  if (!isFiniteNum(next.p1_bet_max)) next.p1_bet_max = 0;

  ensureOrRanges(next);
  ensureOrRangesPlan(next);

  // --- Build or_ranges array for persistence ---
  // If orRanges and orRangesPlan exist, build the array
  if (next.orRanges && next.orRangesPlan) {
    next.or_ranges = Object.entries(next.orRanges).map(([key, range]) => {
      const plan = next.orRangesPlan && (next.orRangesPlan as any)[key];
      return {
        id: key,
        label: key,
        mode: plan?.move || "OR",
        bet_min: plan?.bet_min_bb ?? 0,
        bet_max: plan?.bet_max_bb ?? 0,
        range: range ?? "",
      };
    });
  }

  return next;
}
