import type { StrategyGlobal } from "./constants";

export type Spot = "BTN" | "SB" | "BB";
export type PlayerPos = "BTN" | "SB" | "BB";
export type PlayerTipo = "fish" | "reg" | "unknown";

export type SubStrategyPayload = {
  spot: Spot;

  hero_pos: PlayerPos;

  p1_bet_min: number;
  p1_bet_max: number;
  p1_stack_min: number;
  p1_stack_max: number;
  p1_se_min: number;
  p1_se_max: number;

  p2_pos: PlayerPos;
  p2_tipo: PlayerTipo;
  p2_bet_min: number;
  p2_bet_max: number;
  p2_stack_min: number;
  p2_stack_max: number;

  p3_pos: PlayerPos;
  p3_tipo: PlayerTipo;
  p3_bet_min: number;
  p3_bet_max: number;
  p3_stack_min: number;
  p3_stack_max: number;

  situacion: string;
};

export type SubStrategyItem = {
  id: string;
  payload: SubStrategyPayload;
};

export type StrategyGlobalData = {
  name: StrategyGlobal;
  subs: SubStrategyItem[];
};

export type StrategyStore = {
  version: number;
  globals: Record<string, StrategyGlobalData>;
};
