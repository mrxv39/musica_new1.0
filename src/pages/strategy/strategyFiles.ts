/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\pages\strategy\strategyFiles.ts
 */
import type { StrategyStore, SubStrategyItem, SubStrategyPayload } from "../../strategy/types";
import { isValidPayload } from "../../strategy/substrategy_helpers";
import { ensureGlobal, emptyStore } from "./state";

export function nowIso() {
  return new Date().toISOString();
}

export function uid() {
  return `sub_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function downloadJson(filename: string, data: any) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function makeExportData(store: StrategyStore, globalName: string) {
  const s = ensureGlobal(store ?? emptyStore(), globalName) as any;
  const raw = s.globals?.[globalName]?.subs;

  const subs: SubStrategyItem[] = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object"
      ? (Object.values(raw) as any)
      : [];

  return {
    type: "poker_boss_strategy_export",
    version: 1,
    global: globalName,
    exportedAt: nowIso(),
    subs,
  };
}

export function parseImportItems(globalName: string, jsonText: string): { items: SubStrategyItem[]; error?: string } {
  let parsed: any;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return { items: [], error: "JSON inválido." };
  }

  const importedSubs: any[] = Array.isArray(parsed?.subs) ? parsed.subs : [];
  if (!importedSubs.length) return { items: [], error: "El JSON no contiene subs para importar." };

  const items: SubStrategyItem[] = [];
  for (const raw of importedSubs) {
    const id = typeof raw?.id === "string" ? raw.id : uid();
    const name = typeof raw?.name === "string" ? raw.name : "Importado";
    const payload = raw?.payload as SubStrategyPayload;

    if (!isValidPayload(payload)) continue;

    items.push({
      id,
      global: globalName as any,
      name,
      payload,
      createdAt: typeof raw?.createdAt === "string" ? raw.createdAt : nowIso(),
      updatedAt: nowIso(),
    } as SubStrategyItem);
  }

  if (!items.length) return { items: [], error: "No hay subs válidas para importar." };
  return { items };
}
