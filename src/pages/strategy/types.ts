/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\pages\strategy\types.ts
 */
import type { StrategyGlobal } from "../../strategy/constants";
import type { StrategyStore, SubStrategyItem, SubStrategyPayload } from "../../strategy/types";

export type StrategyVM = {
  store: StrategyStore;
  globalName: StrategyGlobal;
  selectedId: string | null;
  payload: SubStrategyPayload;
  status: string;
};

export type StrategyVMActions = {
  setStore: (s: StrategyStore) => void;
  setGlobalName: (g: StrategyGlobal) => void;
  setSelectedId: (id: string | null) => void;
  setPayload: (p: SubStrategyPayload) => void;
  setStatus: (s: string) => void;
};

export type StrategyComputed = {
  subs: SubStrategyItem[];
  generated: SubStrategyItem;
};
