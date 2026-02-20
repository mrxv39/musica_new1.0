/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\pages\strategy\defaults.ts
 */
import type { StrategyStore, SubStrategyPayload } from "../../strategy/types";
import { computeSituacionFromPositions } from "../../strategy/utils";

export function emptyStore(): StrategyStore {
  return { version: 1, globals: {} };
}

export function defaultPayload(): SubStrategyPayload {
  return {
    spot: "BTN",

    hero_pos: "BTN",
    p1_bet_min: 0,
    p1_bet_max: 75,
    p1_stack_min: 0,
    p1_stack_max: 75,
    p1_se_min: 0,
    p1_se_max: 75,

    p2_pos: "SB",
    p2_tipo: "fish",
    p2_bet_min: 0,
    p2_bet_max: 75,
    p2_stack_min: 0,
    p2_stack_max: 75,

    p3_pos: "BB",
    p3_tipo: "fish",
    p3_bet_min: 0,
    p3_bet_max: 75,
    p3_stack_min: 0,
    p3_stack_max: 75,

    situacion: computeSituacionFromPositions("BTN", "SB", "BB"),
  };
}
