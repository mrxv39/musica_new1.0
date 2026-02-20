/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\pages\strategy\strategyLoad.ts
 */
import type { StrategyStore, SubStrategyItem, SubStrategyPayload } from "../../strategy/types";
import { defaultPayload, emptyStore, ensureGlobal, listSubs } from "./state";

export type LoadResult = {
  store: StrategyStore;
  selectedId: string | null;
  editorValue: SubStrategyPayload;
  subs: SubStrategyItem[];
};

function findFirstId(subs: SubStrategyItem[]) {
  return (subs[0] as any)?.id ? String((subs[0] as any).id) : null;
}

export function applyLoadedStore(opts: {
  loaded: StrategyStore | null | undefined;
  globalName: string;
  prevSelectedId: string | null;
}): LoadResult {
  const { loaded, globalName, prevSelectedId } = opts;

  const fixed = ensureGlobal((loaded ?? emptyStore()) as StrategyStore, globalName);
  const subs = listSubs(fixed, globalName);

  // Mantener selección si existe; si no, seleccionar primera
  const exists = !!(prevSelectedId && subs.some((s: any) => String(s.id) === String(prevSelectedId)));
  const selectedId = exists ? prevSelectedId : findFirstId(subs);

  const selectedItem = selectedId ? (subs.find((s: any) => String(s.id) === String(selectedId)) ?? null) : null;
  const editorValue = (selectedItem as any)?.payload ?? defaultPayload();

  return { store: fixed, selectedId, editorValue, subs };
}
