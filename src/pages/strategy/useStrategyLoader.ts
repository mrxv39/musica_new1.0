/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\pages\strategy\useStrategyLoader.ts
 *
 * Loader:
 * - dbInit + dbLoadSubs al montar
 * - garantiza que exista al menos 1 sub (para que Guardar funcione en tests)
 */
import { useCallback, useEffect } from "react";
import type { StrategyStore, SubStrategyItem, SubStrategyPayload } from "../../strategy/types";
import { dbInit, dbLoadSubs } from "./db";
import { defaultPayload, ensureGlobal, getSubById, listSubs, upsertSub } from "./state";
import { nowIso, uid } from "./model";

function payloadOrDefault(v: any): SubStrategyPayload {
  return (v && typeof v === "object") ? (v as any) : (defaultPayload() as any);
}

export function useStrategyLoader(args: {
  globalName: string;
  store: StrategyStore;

  selectedId: string | null;

  setStore: (s: StrategyStore) => void;
  setSelectedId: (id: string | null) => void;
  setEditorValue: (v: SubStrategyPayload) => void;
  setIsLoading: (v: boolean) => void;
  setError: (v: string | null) => void;
}) {
  const {
    globalName,
    store,
    selectedId,
    setStore,
    setSelectedId,
    setEditorValue,
    setIsLoading,
    setError,
  } = args;

  const reload = useCallback(async (): Promise<StrategyStore> => {
    setIsLoading(true);
    try {
      setError(null);

      await dbInit();

      // load
      const loaded = (await dbLoadSubs(globalName)) as any as StrategyStore;
      let nextStore: StrategyStore = (loaded ?? store) as StrategyStore;

      // asegúrate de que exista el global solicitado
      nextStore = ensureGlobal(nextStore, globalName);

      // si no hay subs, autocrea 1 (esto es lo que los tests necesitan)
      const subs = listSubs(nextStore, globalName);
      if (subs.length === 0) {
        const id = uid();
        const item: SubStrategyItem = {
          ...( {} as any ),
          id,
          global: globalName,
          payload: defaultPayload(),
          name: "Auto sub 1",
          createdAt: nowIso(),
          updatedAt: nowIso(),
        } as any;

        // upsert en store y refrescar referencia
        nextStore = upsertSub(nextStore, globalName, item);
      }

      setStore(nextStore);

      // selección/editorValue coherentes
      const finalSubs = listSubs(nextStore, globalName);

      const effectiveId = selectedId ?? (finalSubs[0]?.id ?? null);
      if (effectiveId) {
        setSelectedId(effectiveId);
        const it = getSubById(nextStore, globalName, effectiveId);
        setEditorValue(payloadOrDefault((it as any)?.payload));
      } else {
        setEditorValue(defaultPayload() as any);
      }

      return nextStore;
    } catch (e: any) {
      const msg = e?.message ? String(e.message) : "unknown";
      setError(`DB load error: ${msg}`);
      return store;
    } finally {
      setIsLoading(false);
    }
  }, [
    globalName,
    selectedId,
    setStore,
    setSelectedId,
    setEditorValue,
    setIsLoading,
    setError,
    store,
  ]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { reload };
}
