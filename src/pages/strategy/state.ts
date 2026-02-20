/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\pages\strategy\state.ts
 *
 * Estado puro. Tipos oficiales: src/strategy/types
 * - globals[global].subs es array
 */
import type { SubStrategyPayload, StrategyStore, SubStrategyItem } from "../../strategy/types";
import { normalizePayload } from "../../strategy/utils";
import { getUiTimeKey } from "./model";

// 🔑 Para que otros módulos puedan importar el tipo desde aquí (StrategySidebar, etc.)
export type { SubStrategyItem };

export function defaultPayload(): SubStrategyPayload {
  return normalizePayload({} as SubStrategyPayload);
}

export function emptyStore(): StrategyStore {
  return { globals: {} } as StrategyStore;
}

export function ensureGlobal(store: StrategyStore | null | undefined, globalName: string): StrategyStore {
  const next = (store ?? emptyStore()) as any;
  if (!next.globals) next.globals = {};
  if (!next.globals[globalName]) next.globals[globalName] = { name: globalName, subs: [] };
  if (!Array.isArray(next.globals[globalName].subs)) next.globals[globalName].subs = [];
  return next as StrategyStore;
}

export function getSubsArray(store: StrategyStore, globalName: string): SubStrategyItem[] {
  const s = ensureGlobal(store, globalName) as any;
  const arr = (s.globals?.[globalName]?.subs ?? []) as SubStrategyItem[];
  return Array.isArray(arr) ? arr : [];
}

export function getSubById(store: StrategyStore, globalName: string, id: string): SubStrategyItem | null {
  return getSubsArray(store, globalName).find((x: any) => x?.id === id) ?? null;
}

export function listSubs(store: StrategyStore, globalName: string): SubStrategyItem[] {
  const subs = [...getSubsArray(store, globalName)];

  subs.sort((a, b) => {
    const ta = getUiTimeKey(a);
    const tb = getUiTimeKey(b);
    if (ta && tb && ta !== tb) return tb.localeCompare(ta);
    return 0;
  });

  return subs;
}

export function upsertSub(store: StrategyStore, globalName: string, item: SubStrategyItem): StrategyStore {
  const s = ensureGlobal(store, globalName) as any;
  const arr = getSubsArray(s as StrategyStore, globalName);
  const idx = arr.findIndex((x: any) => x?.id === (item as any)?.id);
  if (idx >= 0) arr[idx] = item;
  else arr.push(item);
  s.globals[globalName].subs = arr;
  return s as StrategyStore;
}
