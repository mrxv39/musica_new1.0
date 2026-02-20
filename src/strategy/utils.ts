/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\strategy\utils.ts
 */
import type { SubStrategyPayload, PlayerPos, OrRanges } from "./types";

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

  // Ensure orRanges present and all keys filled
  const defaultOrRanges: OrRanges = {
    OR_TO_CALL_ANY: "",
    OPEN_PUSH: "",
    OR_TO_CALL_SMALL: "",
    OR_TO_FOLD: "",
  };

  // Migrate legacy or_ranges (array) if present
  if ((next as any).or_ranges && Array.isArray((next as any).or_ranges)) {
    // Not implemented: migration logic (if needed)
    // For now, ignore and use default
    delete (next as any).or_ranges;
  }

  next.orRanges = { ...defaultOrRanges, ...(next.orRanges || {}) };

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

function fmtRange(min: number, max: number) {
  return min === max ? String(min) : `${min}-${max}`;
}

function truncate(s: string, maxLen: number) {
  if (s.length <= maxLen) return s;
  if (maxLen <= 1) return "…";
  return s.slice(0, Math.max(0, maxLen - 1)) + "…";
}

/**
 * Label amigable para UI (no depende del id infinito).
 */
export function formatSubLabel(p: SubStrategyPayload, maxLen = 90): string {
  const n = normalizePayload(p);

  const base = `${n.hero_pos} vs ${n.p2_pos}/${n.p3_pos} (${n.p2_tipo}/${n.p3_tipo})`;
  const st = `ST ${fmtRange(n.p1_stack_min, n.p1_stack_max)}`;
  const se = `SE ${fmtRange(n.p1_se_min, n.p1_se_max)}`;

  // Incluir bet solo si no es el default típico 0-75
  const betIsDefault = n.p1_bet_min === 0 && n.p1_bet_max === 75;
  const bet = betIsDefault ? "" : ` | bet ${fmtRange(n.p1_bet_min, n.p1_bet_max)}`;

  const sit = n.situacion ? ` | ${n.situacion}` : "";
  const out = `${base} | ${st} | ${se}${bet}${sit}`;

  return truncate(out, maxLen);
}

/**
 * Score para ordenar: más específico (rangos más estrechos) primero.
 * Devuelve un número mayor cuando los rangos son más pequeños.
 */
export function specificityScore(p: SubStrategyPayload): number {
  const n = normalizePayload(p);

  const widths = [
    n.p1_bet_max - n.p1_bet_min,
    n.p1_stack_max - n.p1_stack_min,
    n.p1_se_max - n.p1_se_min,
    n.p2_bet_max - n.p2_bet_min,
    n.p2_stack_max - n.p2_stack_min,
    n.p3_bet_max - n.p3_bet_min,
    n.p3_stack_max - n.p3_stack_min,
  ];

  const safe = widths.map((w) => (Number.isFinite(w) ? Math.max(0, w) : 9999));
  const inv = safe.reduce((acc, w) => acc + 10000 / (1 + w), 0);

  const tipoBonus = (n.p2_tipo !== "unknown" ? 50 : 0) + (n.p3_tipo !== "unknown" ? 50 : 0);
  return inv + tipoBonus;
}
