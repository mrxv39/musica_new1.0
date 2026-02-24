/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\strategy\utils\situation.ts
 */
import type { PlayerPos } from "../types";

/**
 * Situación textual simple.
 * Ej: "BTN_vs_SB_BB"
 */
export function computeSituacionFromPositions(hero: PlayerPos, p2: PlayerPos, p3: PlayerPos): string {
  return hero + "_vs_" + p2 + "_" + p3;
}
