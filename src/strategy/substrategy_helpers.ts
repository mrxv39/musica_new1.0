/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\strategy\substrategy_helpers.ts
 */
import type { SubStrategyPayload } from "./types";

const BAD = new Set(["undefined", "null", ""]);

function isBad(v: unknown) {
  if (v === undefined || v === null) return true;
  const s = String(v).trim().toLowerCase();
  return BAD.has(s);
}

export function isValidPayload(p: SubStrategyPayload): boolean {
  // campos “core” mínimos para que no aparezcan labels tipo "undefined vs undefined"
  if (isBad(p.spot)) return false;
  if (isBad(p.hero_pos)) return false;
  if (isBad(p.p2_pos)) return false;
  if (isBad(p.p3_pos)) return false;
  if (isBad(p.p2_tipo)) return false;
  if (isBad(p.p3_tipo)) return false;

  // rangos numéricos mínimos
  const nums = [
    p.p1_stack_min, p.p1_stack_max,
    p.p1_bet_min, p.p1_bet_max,
    p.p1_se_min, p.p1_se_max,
    p.p2_stack_min, p.p2_stack_max,
    p.p2_bet_min, p.p2_bet_max,
    p.p3_stack_min, p.p3_stack_max,
    p.p3_bet_min, p.p3_bet_max,
  ].map((x) => Number(x));

  if (nums.some((n) => !Number.isFinite(n))) return false;

  return true;
}
