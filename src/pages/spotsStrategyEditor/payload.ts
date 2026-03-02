/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\pages\spotsStrategyEditor\payload.ts
 */

export const DEFAULT_OR_BLOCK = { min: 0, max: 0, range: "" };

export const REQUIRED_OR_BLOCK_KEYS = [
  "OR_TO_CALL_ANY",
  "OPEN_PUSH",
  "OR_TO_CALL_SMALL",
  "OR_TO_FOLD",
  "LIMP_CALL_ANY",
  "LIMP_CALL_SMALL",
  "LIMP_FOLD",
  "LIMP_TO_CALL_ANY",
] as const;

export type OrBlockKey = (typeof REQUIRED_OR_BLOCK_KEYS)[number];

export type OrBlock = {
  min: number;
  max: number;
  range: string;
};

export type SpotsPayload = {
  mode?: "NASH_PUSHFOLD" | string;

  // Nash chart: mano -> regla (15, "11-5", {min,max}, etc.)
  nash?: {
    chart?: Record<string, any>;
  };

  hero_pos: "BTN" | "SB" | "BB";
  p1: { bet_min: number; bet_max: number; st_min: number; st_max: number; se_min: number; se_max: number };
  p2: { pos: "SB" | "BB" | "BTN"; tipo: "unknown" | "fish" | "reg"; bet_min: number; bet_max: number; st_min: number; st_max: number };
  p3: { pos: "SB" | "BB" | "BTN"; tipo: "unknown" | "fish" | "reg"; bet_min: number; bet_max: number; st_min: number; st_max: number };
  or_blocks: Record<string, OrBlock>;
};

export const defaultPayload: SpotsPayload = {
  mode: undefined,
  nash: { chart: {} },

  hero_pos: "BTN",

  p1: { bet_min: 0, bet_max: 0, st_min: 0, st_max: 0, se_min: 0, se_max: 0 },

  p2: { pos: "SB", tipo: "unknown", bet_min: 0, bet_max: 0, st_min: 0, st_max: 0 },

  p3: { pos: "BB", tipo: "unknown", bet_min: 0, bet_max: 0, st_min: 0, st_max: 0 },

  or_blocks: REQUIRED_OR_BLOCK_KEYS.reduce((acc, k) => {
    acc[k] = { ...DEFAULT_OR_BLOCK };
    return acc;
  }, {} as Record<string, OrBlock>),
};