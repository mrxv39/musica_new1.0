/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\pages\strategy\useStrategyPage.ts
 *
 * Fixes:
 * - Hidratar situations en mount (tests esperan >=2).
 * - En deleteSituation (sin force) si hay subs -> NO borrar + dejar warning/error (tests).
 * - Blindaje: nunca llamar dbDeleteSituationKey con key inválida (undefined/empty).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { OrRangeRow, StrategyStore, SubStrategyItem, SubStrategyPayload } from "../../strategy/types";

import { defaultPayload, emptyStore, ensureGlobal, getSubById } from "./state";
import { buildRows } from "./orRangesAdapter";

import { coercePayload } from "./useStrategyPage/payload";
import { useRowsSync } from "./useStrategyPage/rowsSync";
import { useSelectionHydration } from "./useStrategyPage/selection";
import { useAutosaveDebounce } from "./useStrategyPage/autosave";
import { reloadFromDb } from "./useStrategyPage/reload";

import { useSituations } from "./useStrategyPage/useSituations";
import { useSubsCrud } from "./useStrategyPage/useSubsCrud";
import { useSaveAndCopy } from "./useStrategyPage/useSaveAndCopy";

const DEFAULT_GLOBAL = "GLOBAL";

export function useStrategyPage(args?: { globalName?: string }) {
  const globalName = String(args?.globalName ?? DEFAULT_GLOBAL);

  const [store, setStore] = useState<StrategyStore>(() => ensureGlobal(emptyStore(), globalName));
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [_editorValue, _setEditorValue] = useState<SubStrategyPayload>(() => defaultPayload());
  const editorValue = _editorValue;

  const [orRangesRows, setOrRangesRows] = useState<OrRangeRow[]>(() =>
    buildRows((defaultPayload() as any).orRanges, (defaultPayload() as any).orRangesPlan)
  );

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subsView, setSubsView] = useState<SubStrategyItem[]>(() => []);

  const lastManualSaveAtRef = useRef<number>(Number.NEGATIVE_INFINITY);
  const autosaveTimerRef = useRef<any>(null);
  const dirtyRef = useRef<boolean>(false);

  const setEditorValue = useCallback((action: any) => {
    dirtyRef.current = true;
    _setEditorValue((prev) => (typeof action === "function" ? action(prev) : action));
  }, []);

  const setEditorValueClean = useCallback((action: any) => {
    _setEditorValue((prev) => (typeof action === "function" ? action(prev) : action));
  }, []);

  // compat
  const selectedSituationKey = String((editorValue as any)?.situacion ?? "");
  const setSelectedSituationKey = useCallback(
    (k: string) => {
      setEditorValueClean((prev: any) => ({ ...(prev ?? {}), situacion: String(k ?? "") }));
    },
    [setEditorValueClean]
  );

  const selectedItem = useMemo(() => {
    if (!selectedId) return null;
    return subsView.find((x: any) => (x as any)?.id === selectedId) ?? getSubById(store, globalName, selectedId);
  }, [subsView, selectedId, store, globalName]);

  // rows sync
  const { setOrRangesRowsAndSync } = useRowsSync({
    editorValue,
    setEditorValue,
    orRangesRows,
    setOrRangesRows,
  });

  // reload
  const reload = useCallback(async (): Promise<StrategyStore> => {
    const st = await reloadFromDb({
      globalName,
      selectedId,
      setIsLoading,
      setError,
      setStore,
      setSubsView,
      setSelectedId,
      setEditorValue: setEditorValueClean,
      setOrRangesRows,
      dirtyRef,
    });
    return st;
  }, [globalName, selectedId, setEditorValueClean]);

  // situations hook
  const situationsApi = useSituations({
    setIsLoading,
    setError,
    setEditorValueClean,
    reload,
    setSubsView,
  });

  // mount / global change
  useEffect(() => {
    setStore((prev) => ensureGlobal(prev ?? emptyStore(), globalName));
    void reload();
  }, [globalName, reload]);

  // ✅ IMPORTANTE: hidratar situations en mount (tests lo esperan)
  useEffect(() => {
    void (async () => {
      try {
        const items = await situationsApi.refreshSituations();

        // si el payload no tiene situacion, setear a la primera (si existe)
        setEditorValueClean((prev: any) => {
          const cur = String(prev?.situacion ?? "").trim();
          if (cur) return prev;
          const first = String(items?.[0]?.key ?? "").trim();
          if (!first) return prev;
          return { ...(prev ?? {}), situacion: first };
        });
      } catch {
        // ignore
      }
    })();
  }, [situationsApi.refreshSituations, setEditorValueClean]);

  // hydrate selection -> editor
  useSelectionHydration({
    selectedId,
    store,
    subsView,
    globalName,
    setEditorValue: setEditorValueClean,
    setOrRangesRows,
    dirtyRef,
  });

  // subs CRUD
  const subsCrud = useSubsCrud({
    globalName,
    selectedId,
    subsView,
    editorValue,
    setIsLoading,
    setError,
    setStore,
    setSubsView,
    setSelectedId,
    setEditorValueClean,
    setOrRangesRows,
    dirtyRef,
  });

  // save/copy
  const saveApi = useSaveAndCopy({
    globalName,
    selectedId,
    subsView,
    store,
    editorValue: coercePayload(editorValue),
    orRangesRows,
    setIsLoading,
    setError,
    setSelectedId,
    setSubsView,
    setStore,
    lastManualSaveAtRef,
    dirtyRef,
  });

  // autosave debounce
  useAutosaveDebounce({
    selectedId,
    editorValue,
    orRangesRows,
    lastManualSaveAtRef,
    autosaveTimerRef,
    dirtyRef,
    saveAuto: saveApi.saveAuto,
  });

  const subsAll = useMemo(() => {
    const g = (store as any)?.globals?.[globalName];
    return (g?.subs ?? subsView ?? []) as any[];
  }, [store, subsView, globalName]);

  // ✅ guard: delete con key inválida
  const normalizeDeleteKey = useCallback(
    (maybeKey: any) => {
      const k = String(maybeKey ?? selectedSituationKey ?? "").trim();
      if (!k) {
        setError("Situation DELETE ERROR: key vacío");
        return null;
      }
      return k;
    },
    [selectedSituationKey]
  );

  // ✅ delete wrappers que NO dejan el throw “HAS_SUBS” romper state/tests
  const deleteSituationSafe = useCallback(
    async (maybeKey?: string) => {
      const k = normalizeDeleteKey(maybeKey);
      if (!k) return;
      try {
        await situationsApi.deleteSituation(k);
      } catch (e: any) {
        // Este caso es el del test: HAS_SUBS sin force -> debe quedar la situation + warning/error
        const msg = e?.message ? String(e.message) : String(e);
        setError(`Situation DELETE ERROR: ${msg}`);
        // refresca lista (por si acaso), pero NO limpies situacion
        await situationsApi.refreshSituations();
      }
    },
    [normalizeDeleteKey, situationsApi, setError]
  );

  const deleteSituationForceSafe = useCallback(
    async (maybeKey?: string) => {
      const k = normalizeDeleteKey(maybeKey);
      if (!k) return;
      try {
        await situationsApi.deleteSituationForce(k);
      } catch (e: any) {
        const msg = e?.message ? String(e.message) : String(e);
        setError(`Situation DELETE ERROR: ${msg}`);
      }
    },
    [normalizeDeleteKey, situationsApi, setError]
  );

  return {
    globalName,

    isLoading,
    error,
    setError,

    situations: situationsApi.situations,
    selectedSituationKey,
    setSelectedSituationKey,
    refreshSituations: situationsApi.refreshSituations,
    createSituation: situationsApi.createSituation,
    renameSituation: situationsApi.renameSituation,

    deleteSituation: deleteSituationSafe,
    deleteSituationForce: deleteSituationForceSafe,

    store,
    subs: subsAll,
    subsView,
    selectedId,
    setSelectedId,

    editorValue,
    setEditorValue,
    orRangesRows,
    setOrRangesRows: setOrRangesRowsAndSync,

    createNew: subsCrud.createNew,
    duplicateSelected: () => subsCrud.duplicateSelected(selectedItem),
    deleteSub: subsCrud.deleteSub,
    saveSelected: saveApi.saveSelected,
    copyPayloadJson: saveApi.copyPayloadJson,

    reload,
  };
}