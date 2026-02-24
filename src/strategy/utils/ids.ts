/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\strategy\utils\ids.ts
 */
import type { SubStrategyPayload } from "../types";
import { normalizePayload } from "./payload";

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
