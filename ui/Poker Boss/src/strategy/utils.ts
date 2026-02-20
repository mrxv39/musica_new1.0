import type { SubStrategyPayload, PlayerPos } from "./types";

/**
 * Situación textual simple (puedes refinarlo después).
 * Ej: "BTN_vs_SB_BB"
 */
export function computeSituacionFromPositions(hero: PlayerPos, p2: PlayerPos, p3: PlayerPos): string {
  return `${hero}_vs_${p2}_${p3}`;
}

/**
 * ID determinista para dedupe/listas.
 * Si luego quieres, puedes meter hash.
 */
export function makeSubId(p: SubStrategyPayload): string {
  // "BTN|H:BTN|P2:SB(fish)|P3:BB(fish)|bet:0-75|st:0-75|se:0-75"
  const parts = [
    `spot:${p.spot}`,
    `hero:${p.hero_pos}`,
    `p1bet:${p.p1_bet_min}-${p.p1_bet_max}`,
    `p1st:${p.p1_stack_min}-${p.p1_stack_max}`,
    `p1se:${p.p1_se_min}-${p.p1_se_max}`,
    `p2:${p.p2_pos}(${p.p2_tipo})`,
    `p2bet:${p.p2_bet_min}-${p.p2_bet_max}`,
    `p2st:${p.p2_stack_min}-${p.p2_stack_max}`,
    `p3:${p.p3_pos}(${p.p3_tipo})`,
    `p3bet:${p.p3_bet_min}-${p.p3_bet_max}`,
    `p3st:${p.p3_stack_min}-${p.p3_stack_max}`,
    `sit:${p.situacion}`,
  ];
  return parts.join("|");
}
