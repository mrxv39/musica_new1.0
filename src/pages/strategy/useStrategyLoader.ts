/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\pages\strategy\useStrategyLoader.ts
 *
 * Loader estable:
 * - Carga DB SOLO en mount y cuando cambia globalName.
 * - NO recarga cuando cambia el editor (payload/orRanges/store).
 * - Expone reload() manual para import/export.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { StrategyStore, SubStrategyItem } from "../../strategy/types";
import { ensureGlobal, listSubs } from "../../strategy/store";
import { dbInit, dbLoadSubs } from "./db";

export type UseStrategyLoaderArgs = {
  globalName: string;
  setStore: (s: StrategyStore) => void;
  // callback opcional para seleccionar el primer item tras cargar
  onLoadedSelectFirst?: (item: SubStrategyItem | null) => void;
};

export function useStrategyLoader({ globalName, setStore, onLoadedSelectFirst }: UseStrategyLoaderArgs) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  const loadedOnceByGlobal = useRef<Set<string>>(new Set());
  const inFlight = useRef(false);

  const load = useCallback(
    async (force = false) => {
      if (inFlight.current) return;
      if (!force && loadedOnceByGlobal.current.has(globalName)) return;

      inFlight.current = true;
      setLoading(true);
      setError("");

      try {
        await dbInit();
        const loaded = await dbLoadSubs(globalName);
        setStore(loaded);

        loadedOnceByGlobal.current.add(globalName);

        // Selección inicial (solo tras load)
        const g = ensureGlobal(loaded, globalName as any);
        const subs = listSubs(g as any, globalName as any);
        const first = subs.length ? subs[0] : null;
        onLoadedSelectFirst?.(first);
      } catch (e: any) {
        setError(String(e?.message || e));
      } finally {
        setLoading(false);
        inFlight.current = false;
      }
    },
    [globalName, setStore, onLoadedSelectFirst]
  );

  // ✅ Carga SOLO al entrar / cambiar globalName
  useEffect(() => {
    load(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [globalName]);

  // ✅ Reload manual (para Import/Export)
  const reload = useCallback(async () => {
    await load(true);
  }, [load]);

  return { loading, error, reload };
}
