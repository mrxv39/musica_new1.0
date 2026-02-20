import type { StrategyStore, StrategyGlobalData, SubStrategyItem } from "./types";
import type { StrategyGlobal } from "./constants";

const LS_KEY = "pokerboss.strategy.store.v1";

export function loadStrategyStore(): StrategyStore {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return defaultStore();
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== "object") return defaultStore();
    if (typeof obj.version !== "number" || !obj.globals) return defaultStore();
    return obj as StrategyStore;
  } catch {
    return defaultStore();
  }
}

export function saveStrategyStore(store: StrategyStore) {
  localStorage.setItem(LS_KEY, JSON.stringify(store));
}

function defaultStore(): StrategyStore {
  return {
    version: 1,
    globals: {
      BASE: { name: "BASE", subs: [] },
    },
  };
}

export function ensureGlobal(store: StrategyStore, globalName: StrategyGlobal) {
  if (!store.globals) store.globals = {};
  if (!store.globals[globalName]) {
    store.globals[globalName] = { name: globalName, subs: [] } as StrategyGlobalData;
  }
}

export function listSubs(store: StrategyStore, globalName: StrategyGlobal): SubStrategyItem[] {
  ensureGlobal(store, globalName);
  return store.globals[globalName].subs || [];
}

/**
 * Upsert por id.
 * Devuelve índice seleccionado.
 */
export function upsertSub(store: StrategyStore, globalName: StrategyGlobal, item: SubStrategyItem): number {
  ensureGlobal(store, globalName);
  const subs = store.globals[globalName].subs || (store.globals[globalName].subs = []);
  const idx = subs.findIndex((x) => x.id === item.id);
  if (idx >= 0) {
    subs[idx] = item;
    return idx;
  }
  subs.unshift(item); // nuevo arriba
  return 0;
}

export function deleteSub(store: StrategyStore, globalName: StrategyGlobal, index: number) {
  ensureGlobal(store, globalName);
  const subs = store.globals[globalName].subs || [];
  if (index < 0 || index >= subs.length) return;
  subs.splice(index, 1);
}
