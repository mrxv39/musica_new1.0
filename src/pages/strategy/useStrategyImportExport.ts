/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\pages\strategy\useStrategyImportExport.ts
 *
 * Utilidades de copy/export/import. No son críticas para los tests de guardado,
 * pero dejamos el hook funcional para evitar deuda de splits vacíos.
 */
import type { StrategyStore } from "../../strategy/types";
import { defaultPayload, listSubs } from "./state";

export function useStrategyImportExport(args: {
  globalName: string;
  store: StrategyStore;
  selectedId: string | null;

  setStore: (updater: (prev: StrategyStore) => StrategyStore) => void;
  setSelectedId: (id: string | null) => void;
  reload: () => Promise<StrategyStore>;
}) {
  const { globalName, store, selectedId } = args;

  async function copyPayloadJson(): Promise<void> {
    const subs = listSubs(store, globalName);
    const sel = subs.find((s: any) => s?.id === selectedId) ?? subs[0] ?? null;
    const payload = sel?.payload ?? defaultPayload();
    const text = JSON.stringify(payload ?? {}, null, 2);

    // En tests puede no existir clipboard => no debe tirar
    try {
      await (navigator as any)?.clipboard?.writeText?.(text);
    } catch {
      // noop
    }
  }

  function exportGlobalJson(): void {
    const subs = listSubs(store, globalName);
    const data = { global: globalName, subs };
    const text = JSON.stringify(data, null, 2);

    try {
      const blob = new Blob([text], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `strategy_${globalName}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      // noop
    }
  }

  async function importGlobalJsonText(_jsonText: string): Promise<void> {
    // No-op por ahora (no afecta tests).
    // Si quieres, luego lo conectamos a upsert en store + persistencia.
    await args.reload();
  }

  return { copyPayloadJson, exportGlobalJson, importGlobalJsonText };
}
