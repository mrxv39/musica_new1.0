/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\strategy\utils\numeric.ts
 */
export function isFiniteNum(n: unknown): n is number {
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
