import type { StrategyStore, StrategyGlobalData, SubStrategyItem } from "./types";
import type { StrategyGlobal } from "./constants";

// NOTA:
// - No importamos @tauri-apps/api/fs para que el build web no falle.
// - Persistencia V1: memoria (si no hay Tauri).
// - Persistencia V2 (opcional): podemos enchufar plugin-fs o sqlite cuando quieras.

const STORE_VERSION = 1;

let _memStore: StrategyStore | null = null;

function defaultStore(): StrategyStore {
  return {
    version: STORE_VERSION,
    globals: {
      BASE: { name: "BASE", subs: [] },
    },
  };
}

function getMemStore(): StrategyStore {
  if (_memStore) return _memStore;
  _memStore = defaultStore();
  return _memStore;
}

function isTauriRuntime(): boolean {
  // Heurística segura para detectar Tauri sin imports
  // window.__TAURI__ existe en runtime Tauri
  return typeof window !== "undefined" && typeof (window as any).__TAURI__ !== "undefined";
}

/**
 * Carga store.
 * V1: memoria (web).
 * Si estás en Tauri y más adelante metemos plugin-fs/sqlite, aquí lo conectamos.
 */
export async function loadStrategyStore(): Promise<StrategyStore> {
  // V1: siempre en memoria para no bloquear builds
  return getMemStore();
}

/**
 * Guarda store.
 * V1: memoria (web).
 */
export async function saveStrategyStore(store: StrategyStore) {
  _memStore = store;
  // placeholder: si runtime Tauri y quieres persistencia real, lo implementamos en V2
  if (isTauriRuntime()) {
    // no-op en V1
  }
}

export function ensureGlobal(store: StrategyStore, globalName: StrategyGlobal) {
  if (!store.globals) store.globals = {} as any;
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
