/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\pages\strategy\useStrategyPage.ts
 *
 * Hook compuesto (refactor):
 * - carga + hydration + autosave + facade UI
 * - delega a hooks: useSituations / useSubsCrud / useSaveAndCopy
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { OrRangeRow, StrategyStore, SubStrategyItem, SubStrategyPayload } from "../../strategy/types";

import { dbListSituations } from "./db";
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

  // autosave refs
  const lastManualSaveAtRef = useRef<number>(Number.NEGATIVE_INFINITY);
  const autosaveTimerRef = useRef<any>(null);
  const dirtyRef = useRef<boolean>(false);

  // setters estables
  const setEditorValue: React.Dispatch<React.SetStateAction<SubStrategyPayload>> = useCallback((action) => {
    dirtyRef.current = true;
    _setEditorValue((prev) => (typeof action === "function" ? (action as any)(prev) : (action as any)));
  }, []);

  const setEditorValueClean: React.Dispatch<React.SetStateAction<SubStrategyPayload>> = useCallback((action) => {
    _setEditorValue((prev) => (typeof action === "function" ? (action as any)(prev) : (action as any)));
  }, []);

  // compat StrategyPage.tsx
  const selectedSituationKey = String((editorValue as any)?.situacion ?? "");
  const setSelectedSituationKey = useCallback(
    (k: string) => {
      setEditorValueClean((prev) => ({ ...(prev as any), situacion: String(k ?? "") }) as any);
    },
    [setEditorValueClean]
  );

  const selectedItem = useMemo(() => {
    if (!selectedId) return null;
    return subsView.find((x: any) => (x as any)?.id === selectedId) ?? getSubById(store, globalName, selectedId);
  }, [subsView, selectedId, store, globalName]);

  // rows sync (editorValue <-> rows)
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

    // situations preload (no bloquea)
    try {
      const rows = await dbListSituations();
      const keys = (rows ?? []).map((r: any) => String(r?.key ?? "")).filter((k) => k.length > 0);
      situationsApi.setSituations(keys);

      setEditorValueClean((prev) => {
        const cur = String((prev as any)?.situacion ?? "");
        if (cur && keys.includes(cur)) return prev;
        if (!cur && keys.length) return { ...(prev as any), situacion: keys[0] } as any;
        return prev;
      });
    } catch {
      // ignore
    }

    return st;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [globalName, selectedId, setEditorValueClean]);

  useEffect(() => {
    setStore((prev) => ensureGlobal(prev ?? emptyStore(), globalName));
    void reload();
  }, [globalName, reload]);

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

  // extracted: situations
  const situationsApi = useSituations({
    setIsLoading,
    setError,
    setEditorValueClean,
    reload,
    setSubsView,
  });

  // extracted: subs crud
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

  // extracted: save/copy
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

  // derived for UI
  const subsAll = useMemo(() => {
    const g = (store as any)?.globals?.[globalName];
    return (g?.subs ?? subsView ?? []) as any[];
  }, [store, subsView, globalName]);

  return {
    globalName,

    isLoading,
    error,
    setError,

    // situations (compat StrategyPage)
    situations: situationsApi.situations,
    selectedSituationKey,
    setSelectedSituationKey,
    refreshSituations: situationsApi.refreshSituations,
    createSituation: situationsApi.createSituation,
    renameSituation: situationsApi.renameSituation,
    deleteSituation: situationsApi.deleteSituation,
    deleteSituationForce: situationsApi.deleteSituationForce,

    // list + selection
    store,
    subs: subsAll,
    subsView,
    selectedId,
    setSelectedId,

    // editor
    editorValue,
    setEditorValue,
    orRangesRows,
    setOrRangesRows: setOrRangesRowsAndSync,

    // actions
    createNew: subsCrud.createNew,
    duplicateSelected: () => subsCrud.duplicateSelected(selectedItem),
    deleteSub: subsCrud.deleteSub,
    saveSelected: saveApi.saveSelected,
    copyPayloadJson: saveApi.copyPayloadJson,

    reload,
  };
}