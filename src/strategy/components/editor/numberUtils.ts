/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\strategy\components\editor\numberUtils.ts
 */
export function round2(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

export function clampNum2(v: number, min = 0, max = 9999) {
  if (!Number.isFinite(v)) return min;
  const c = Math.max(min, Math.min(max, v));
  return round2(c);
}

export function safeNumFromInput(valueAsNumber: number) {
  if (!Number.isFinite(valueAsNumber)) return 0;
  return valueAsNumber;
}
