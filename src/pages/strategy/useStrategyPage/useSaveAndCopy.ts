/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\pages\strategy\useStrategyPage\useSaveAndCopy.ts
 */
import { useCallback } from "react";
import type { OrRangeRow, StrategyStore, SubStrategyItem } from "../../../strategy/types";

import { dbSaveSub } from "../db";
import { emptyStore, ensureGlobal, getSubById, upsertSub } from "../state";
import { rowsToOrRanges, rowsToOrRangesPlan } from "../orRangesAdapter";

import { makeId } from "./ids";
import { upsertInArray } from "./array";
import { coercePayload } from "./payload";

type SetError = (v: string | null) => void;

export function useSaveAndCopy(args: {
  globalName: string;

  selectedId: string | null;
  subsView: SubStrategyItem[];
  store: StrategyStore;

  editorValue: any;
  orRangesRows: OrRangeRow[];

  setIsLoading: (v: boolean) => void;
  setError: SetError;
  setSelectedId: React.Dispatch<React.SetStateAction<string | null>>;
  setSubsView: React.Dispatch<React.SetStateAction<SubStrategyItem[]>>;
  setStore: React.Dispatch<React.SetStateAction<StrategyStore>>;

  lastManualSaveAtRef: React.MutableRefObject<number>;
  dirtyRef: React.MutableRefObject<boolean>;
}) {
  const {
    globalName,
    selectedId,
    subsView,
    store,
    editorValue,
    orRangesRows,
    setIsLoading,
    setError,
    setSelectedId,
    setSubsView,
    setStore,
    lastManualSaveAtRef,
    dirtyRef,
  } = args;

  const saveSelectedInternal = useCallback(
    async (mode: "manual" | "auto") => {
      if (mode === "manual") {
        setIsLoading(true);
        setError(null);
      }

      try {
        const id = selectedId ?? makeId();

        // Nota: no necesitamos "existing" (solo causaba warning TS).
        // El nombre viene del item actual si existe, o por defecto.
        const currentName =
          (id ? (subsView.find((x: any) => (x as any)?.id === id) as any)?.name : null) ??
          (id ? (getSubById(store, globalName, id) as any)?.name : null) ??
          `Auto sub ${subsView.length + 1}`;

        const p = coercePayload(editorValue);

        const rows = orRangesRows;
        const orRanges = rowsToOrRanges(rows);
        const orRangesPlan = rowsToOrRangesPlan(rows);

        const payloadToSave = coercePayload({ ...(p as any), orRanges, orRangesPlan });

        const item: SubStrategyItem = {
          id,
          name: String(currentName),
          payload: payloadToSave,
          or_ranges: rows as any,
        } as any;

        await dbSaveSub({ ...(item as any), globalName });

        setSubsView((prev) => upsertInArray(prev, item));
        setStore((prev) => upsertSub(ensureGlobal(prev ?? emptyStore(), globalName), globalName, item));

        if (!selectedId) setSelectedId(id);

        dirtyRef.current = false;

        if (mode === "manual") {
          lastManualSaveAtRef.current = Date.now();
          setError("Guardado en sqlite");
        }
      } catch (e: any) {
        if (mode === "manual") {
          const msg = e?.message ? String(e.message) : String(e);
          setError(`DB Save ERROR: ${msg}`);
        }
      } finally {
        if (mode === "manual") setIsLoading(false);
      }
    },
    [
      editorValue,
      globalName,
      lastManualSaveAtRef,
      orRangesRows,
      selectedId,
      setError,
      setIsLoading,
      setSelectedId,
      setStore,
      setSubsView,
      store,
      subsView,
      dirtyRef,
    ]
  );

  const saveSelected = useCallback(async () => {
    await saveSelectedInternal("manual");
  }, [saveSelectedInternal]);

  const saveAuto = useCallback(() => {
    void saveSelectedInternal("auto");
  }, [saveSelectedInternal]);

  const copyPayloadJson = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(editorValue, null, 2));
      setError("Copiado");
    } catch {
      setError("Copy ERROR");
    }
  }, [editorValue, setError]);

  return {
    saveSelected,
    saveAuto,
    copyPayloadJson,
  };
}