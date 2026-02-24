/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\pages\strategy\defaults.ts
 */
import type { StrategyStore, SubStrategyPayload, OrRangesPlan } from "../../strategy/types";
import { computeSituacionFromPositions } from "../../strategy/utils";

export function emptyStore(): StrategyStore {
  return { version: 1, globals: {} };
}

function defaultOrRanges() {
  return {
    OR_TO_CALL_ANY: "",
    OPEN_PUSH: "",
    OR_TO_CALL_SMALL: "",
    OR_TO_FOLD: "",
  };
}

function defaultOrRangesPlan(): OrRangesPlan {
  return {
    OR_TO_CALL_ANY: { move: "OR", bet_min_bb: 0, bet_max_bb: 0 },
    OPEN_PUSH: { move: "OR", bet_min_bb: 0, bet_max_bb: 0 },
    OR_TO_CALL_SMALL: { move: "OR", bet_min_bb: 0, bet_max_bb: 0 },
    OR_TO_FOLD: { move: "OR", bet_min_bb: 0, bet_max_bb: 0 },
  };
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

    // rangos estrictos
    orRanges: defaultOrRanges(),

    // plan UI por fila (move + bet min/max BB)
    orRangesPlan: defaultOrRangesPlan(),
  };
}
