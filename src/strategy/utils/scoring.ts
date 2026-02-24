/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\strategy\utils\scoring.ts
 */
import type { SubStrategyPayload } from "../types";
import { normalizePayload } from "./payload";

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
