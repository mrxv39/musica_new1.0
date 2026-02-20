import type { SubStrategyPayload, PlayerPos } from "./types";

/**
 * Situación textual simple.
 * Ej: "BTN_vs_SB_BB"
 */
export function computeSituacionFromPositions(hero: PlayerPos, p2: PlayerPos, p3: PlayerPos): string {
  return hero + "_vs_" + p2 + "_" + p3;
}

function isFiniteNum(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

export function clampNum(v: number, min = 0, max = 9999) {
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, v));
}

/**
 * Redondeo al step (por defecto 0.5)
 */
export function roundToStep(n: number, step = 0.5) {
  if (!Number.isFinite(n) || step <= 0) return 0;
  return Math.round(n / step) * step;
}

/**
 * Coerce min/max:
 * - clamp / round
 * - asegura min<=max
 */
export function coerceMinMax(
  minV: number,
  maxV: number,
  opts?: { min?: number; max?: number; step?: number }
): { min: number; max: number } {
  const lo = opts?.min ?? 0;
  const hi = opts?.max ?? 9999;
  const step = opts?.step ?? 0.5;

  let a = clampNum(roundToStep(minV, step), lo, hi);
  let b = clampNum(roundToStep(maxV, step), lo, hi);

  if (a > b) {
    const t = a;
    a = b;
    b = t;
  }

  return { min: a, max: b };
}

/**
 * Normaliza el payload con reglas:
 * - números finitos
 * - min<=max
 * - clamp bounds
 * - step 0.5
 */
export function normalizePayload(p: SubStrategyPayload): SubStrategyPayload {
  const next: SubStrategyPayload = { ...p };

  const p1bet = coerceMinMax(next.p1_bet_min, next.p1_bet_max, { min: 0, max: 9999, step: 0.5 });
  next.p1_bet_min = p1bet.min;
  next.p1_bet_max = p1bet.max;

  const p1st = coerceMinMax(next.p1_stack_min, next.p1_stack_max, { min: 0, max: 9999, step: 0.5 });
  next.p1_stack_min = p1st.min;
  next.p1_stack_max = p1st.max;

  const p1se = coerceMinMax(next.p1_se_min, next.p1_se_max, { min: 0, max: 9999, step: 0.5 });
  next.p1_se_min = p1se.min;
  next.p1_se_max = p1se.max;

  const p2bet = coerceMinMax(next.p2_bet_min, next.p2_bet_max, { min: 0, max: 9999, step: 0.5 });
  next.p2_bet_min = p2bet.min;
  next.p2_bet_max = p2bet.max;

  const p2st = coerceMinMax(next.p2_stack_min, next.p2_stack_max, { min: 0, max: 9999, step: 0.5 });
  next.p2_stack_min = p2st.min;
  next.p2_stack_max = p2st.max;

  const p3bet = coerceMinMax(next.p3_bet_min, next.p3_bet_max, { min: 0, max: 9999, step: 0.5 });
  next.p3_bet_min = p3bet.min;
  next.p3_bet_max = p3bet.max;

  const p3st = coerceMinMax(next.p3_stack_min, next.p3_stack_max, { min: 0, max: 9999, step: 0.5 });
  next.p3_stack_min = p3st.min;
  next.p3_stack_max = p3st.max;

  // situacion siempre derivada de posiciones
  next.situacion = computeSituacionFromPositions(next.hero_pos, next.p2_pos, next.p3_pos);

  // fallback defensivo
  if (!isFiniteNum(next.p1_bet_min)) next.p1_bet_min = 0;
  if (!isFiniteNum(next.p1_bet_max)) next.p1_bet_max = 0;

  return next;
}

/**
 * ID determinista para dedupe/listas.
 * Basado en payload NORMALIZADO.
 */
export function makeSubId(p: SubStrategyPayload): string {
  const n = normalizePayload(p);

  const parts = [
    "spot:" + n.spot,
    "hero:" + n.hero_pos,
    "p1bet:" + n.p1_bet_min + "-" + n.p1_bet_max,
    "p1st:" + n.p1_stack_min + "-" + n.p1_stack_max,
    "p1se:" + n.p1_se_min + "-" + n.p1_se_max,
    "p2:" + n.p2_pos + "(" + n.p2_tipo + ")",
    "p2bet:" + n.p2_bet_min + "-" + n.p2_bet_max,
    "p2st:" + n.p2_stack_min + "-" + n.p2_stack_max,
    "p3:" + n.p3_pos + "(" + n.p3_tipo + ")",
    "p3bet:" + n.p3_bet_min + "-" + n.p3_bet_max,
    "p3st:" + n.p3_stack_min + "-" + n.p3_stack_max,
    "sit:" + n.situacion,
  ];

  return parts.join("|");
}
