/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\strategy\utils\labels.ts
 */
import type { SubStrategyPayload } from "../types";
import { normalizePayload } from "./payload";

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
