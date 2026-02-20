/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\pages\strategy\strategyActions.ts
 */
import type { StrategyStore, SubStrategyItem, SubStrategyPayload } from "../../strategy/types";
import { isValidPayload } from "../../strategy/substrategy_helpers";
import { defaultPayload, emptyStore, ensureGlobal, listSubs } from "./state";
import { makeExportData, nowIso, downloadJson, parseImportItems, uid } from "./strategyFiles";

export function formatDbSaveError(e: any) {
  const msg = e?.message ? String(e.message) : String(e ?? "");
  return `db save error: ${msg}`.trim();
}

export function selectById(subs: SubStrategyItem[], id: string | null): SubStrategyItem | null {
  if (!id) return null;
  return subs.find((s: any) => String(s.id) === String(id)) ?? null;
}

export function createNewInStore(prev: StrategyStore, globalName: string): { next: StrategyStore; item: SubStrategyItem } {
  const subs = listSubs(prev ?? emptyStore(), globalName);
  const ts = nowIso();

  const item: SubStrategyItem = {
    id: uid(),
    global: globalName as any,
    name: `Nueva sub ${subs.length + 1}`,
    payload: defaultPayload(),
    createdAt: ts,
    updatedAt: ts,
  } as SubStrategyItem;

  const next = ensureGlobal(structuredClone((prev ?? emptyStore()) as any), globalName) as any;
  next.globals[globalName].subs.push(item);

  return { next: next as StrategyStore, item };
}

export function duplicateInStore(
  prev: StrategyStore,
  globalName: string,
  base: SubStrategyItem
): { next: StrategyStore; item: SubStrategyItem } {
  const ts = nowIso();
  const item: SubStrategyItem = {
    id: uid(),
    global: globalName as any,
    name: `${(base as any).name ?? "Subestrategia"} (copia)`,
    payload: (base as any).payload,
    createdAt: ts,
    updatedAt: ts,
  } as SubStrategyItem;

  const next = ensureGlobal(structuredClone((prev ?? emptyStore()) as any), globalName) as any;
  next.globals[globalName].subs.push(item);

  return { next: next as StrategyStore, item };
}

export function buildSaveItem(opts: {
  globalName: string;
  selectedId: string;
  payload: SubStrategyPayload;
  existing?: SubStrategyItem | null;
}): { item?: SubStrategyItem; error?: string } {
  const { globalName, selectedId, payload, existing } = opts;

  if (!isValidPayload(payload)) return { error: "Payload inválido: revisa rangos/valores antes de guardar." };

  const item: SubStrategyItem = {
    id: selectedId,
    global: globalName as any,
    name: (existing as any)?.name ?? "Subestrategia",
    payload,
    createdAt: (existing as any)?.createdAt ?? nowIso(),
    updatedAt: nowIso(),
  } as SubStrategyItem;

  return { item };
}

export function exportGlobal(store: StrategyStore, globalName: string) {
  const data = makeExportData(store ?? emptyStore(), globalName);
  const filename = `strategy_${globalName}_${new Date().toISOString().slice(0, 10)}.json`;
  downloadJson(filename, data);
}

export function parseImport(globalName: string, jsonText: string) {
  return parseImportItems(globalName, jsonText);
}
