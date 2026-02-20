/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\pages\strategy\storeView.ts
 */
import type { StrategyGlobal } from "../../strategy/constants";
import type { StrategyStore, SubStrategyItem, SubStrategyPayload } from "../../strategy/types";
import { ensureGlobal, listSubs, upsertSub } from "../../strategy/store";
import { makeSubId, computeSituacionFromPositions } from "../../strategy/utils";

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

    // ✅ requerido por SubStrategyPayload
    orRanges: defaultOrRanges(),
  };
}

export function deriveGenerated(payload: SubStrategyPayload): SubStrategyItem {
  const p: SubStrategyPayload = { ...payload };

  // situacion siempre derivada
  p.situacion = computeSituacionFromPositions(p.hero_pos, p.p2_pos, p.p3_pos);

  // fallback defensivo: orRanges siempre existe
  if (!p.orRanges) p.orRanges = defaultOrRanges();

  const id = makeSubId(p);
  return { id, payload: p };
}

export function viewSubs(store: StrategyStore, globalName: StrategyGlobal): SubStrategyItem[] {
  ensureGlobal(store, globalName);
  return listSubs(store, globalName);
}

export function uiUpsert(store: StrategyStore, globalName: StrategyGlobal, item: SubStrategyItem): StrategyStore {
  const next: StrategyStore = { ...store };
  ensureGlobal(next, globalName);
  upsertSub(next, globalName, item);
  return next;
}
