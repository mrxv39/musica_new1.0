import type { StrategyGlobal } from "./constants";

export type Spot = "BTN" | "SB" | "BB";
export type PlayerPos = "BTN" | "SB" | "BB";
export type PlayerTipo = "fish" | "reg" | "unknown";

export type OrRangeKey = "OR_TO_CALL_ANY" | "OPEN_PUSH" | "OR_TO_CALL_SMALL" | "OR_TO_FOLD";
export type OrRanges = Record<OrRangeKey, string>;

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

  orRanges: OrRanges;
};

export type OrMove = "OR" | "PUSH" | "FOLD";

export type OrRangeRow = {
  id: string;
  range: string;
  move: OrMove;
  value_min: number;
  value_max: number;
};

export type SubStrategyItem = {
  id: string;
  payload: SubStrategyPayload;

  // optional (V2): OR Ranges per sub
  or_ranges?: OrRangeRow[];
};

export type StrategyGlobalData = {
  name: StrategyGlobal;
  subs: SubStrategyItem[];
};

export type StrategyStore = {
  version: number;
  globals: Record<string, StrategyGlobalData>;
};
