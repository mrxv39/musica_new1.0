import type { StrategyStore, StrategyGlobalData, SubStrategyItem } from "./types";
import type { StrategyGlobal } from "./constants";
import { formatSubLabel, specificityScore } from "./utils";

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

function sortSubsDeterministic(items: SubStrategyItem[]): SubStrategyItem[] {
  const copy = [...items];
  copy.sort((a, b) => {
    const sa = specificityScore(a.payload);
    const sb = specificityScore(b.payload);
    if (sb !== sa) return sb - sa;

    const sita = a.payload.situacion || "";
    const sitb = b.payload.situacion || "";
    if (sita !== sitb) return sita.localeCompare(sitb);

    const la = formatSubLabel(a.payload);
    const lb = formatSubLabel(b.payload);
    if (la !== lb) return la.localeCompare(lb);

    return a.id.localeCompare(b.id);
  });
  return copy;
}

/**
 * Lista subestrategias para UI.
 * IMPORTANTE: Devuelve una copia ORDENADA (no muta el array interno).
 */
export function listSubs(store: StrategyStore, globalName: StrategyGlobal): SubStrategyItem[] {
  ensureGlobal(store, globalName);
  const subs = store.globals[globalName].subs || [];
  return sortSubsDeterministic(subs);
}

/**
 * Upsert por id.
 * Devuelve índice interno (no ordenado).
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

/**
 * Borrado por id (robusto aunque UI esté ordenada).
 */
export function deleteSubById(store: StrategyStore, globalName: StrategyGlobal, id: string): boolean {
  ensureGlobal(store, globalName);
  const subs = store.globals[globalName].subs || [];
  const idx = subs.findIndex((x) => x.id === id);
  if (idx < 0) return false;
  subs.splice(idx, 1);
  return true;
}

/**
 * Compat legacy (índice interno).
 * Si tu UI está ordenada, usa deleteSubById.
 */
export function deleteSub(store: StrategyStore, globalName: StrategyGlobal, index: number) {
  ensureGlobal(store, globalName);
  const subs = store.globals[globalName].subs || [];
  if (index < 0 || index >= subs.length) return;
  subs.splice(index, 1);
}
