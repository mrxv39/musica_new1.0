import { useEffect, useMemo, useRef, useState } from "react";
import type { OrRangeRow, StrategyStore, SubStrategyItem, SubStrategyPayload } from "../../../strategy/types";

import { dbInit, dbLoadSubs } from "../db";
import { defaultPayload, emptyStore, getSubById, listSubs } from "../state";
import { buildRows } from "../orRangesAdapter";

import { useRowsSync } from "../useStrategyPage/rowsSync";
import { useSelectionHydration } from "../useStrategyPage/selection";
import { useAutosaveDebounce } from "../useStrategyPage/autosave";

import { createNewSub, duplicateSelectedSub, deleteSubById } from "./crud";
import { saveSelectedInternal } from "./save";

function safeStringify(x: any) {
  try {
    return JSON.stringify(x, null, 2);
  } catch {
    return String(x ?? "");
  }
}

async function copyTextToClipboard(text: string) {
  // Prefer navigator.clipboard
  if (typeof navigator !== "undefined" && (navigator as any)?.clipboard?.writeText) {
    await (navigator as any).clipboard.writeText(text);
    return;
  }

  // Fallback: hidden textarea + execCommand
  if (typeof document !== "undefined") {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "true");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    ta.style.top = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    if (!ok) throw new Error("execCommand(copy) failed");
    return;
  }

  throw new Error("Clipboard not available");
}

export function useStrategyPage({ globalName }: { globalName: string }) {
  const [store, setStore] = useState<StrategyStore>(() => emptyStore());
  const [subsView, setSubsView] = useState<SubStrategyItem[]>(() => []);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editorValue, setEditorValue] = useState<SubStrategyPayload>(() => defaultPayload());

  const [orRangesRows, setOrRangesRows] = useState<OrRangeRow[]>(() =>
    buildRows((defaultPayload() as any).orRanges, (defaultPayload() as any).orRangesPlan)
  );

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lastManualSaveAtRef = useRef<number>(Number.NEGATIVE_INFINITY);
  const autosaveTimerRef = useRef<number | null>(null);
  const dirtyRef = useRef<boolean>(false);

  const reload = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await dbInit();
      const s = await dbLoadSubs(globalName);
      setStore(s);
      const v = listSubs(s, globalName);
      setSubsView(v);

      // ✅ auto-seleccionar una sub si no hay ninguna seleccionada
      if (!selectedId) {
        setSelectedId(v.length ? String((v[0] as any).id) : null);
      } else if (!v.find((x: any) => String((x as any)?.id) === String(selectedId))) {
        setSelectedId(v.length ? String((v[0] as any).id) : null);
      }
    } catch (e: any) {
      const msg = e?.message ? String(e.message) : String(e);
      setError(`DB LOAD ERROR: ${msg}`);
      setStore(emptyStore());
      setSubsView([]);
      setSelectedId(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [globalName]);

  const selectedItem = useMemo(() => {
    if (!selectedId) return null;
    return subsView.find((x: any) => (x as any)?.id === selectedId) ?? getSubById(store, globalName, selectedId);
  }, [subsView, selectedId, store, globalName]);

  useSelectionHydration({
    selectedId,
    store,
    subsView,
    globalName,
    setEditorValue,
    setOrRangesRows,
    dirtyRef,
  });

  const { setOrRangesRowsAndSync } = useRowsSync({
    editorValue,
    setEditorValue,
    orRangesRows,
    setOrRangesRows,
  });

  useAutosaveDebounce({
    selectedId,
    editorValue,
    orRangesRows,
    lastManualSaveAtRef,
    autosaveTimerRef,
    dirtyRef,
    saveAuto: () => {
      if (!selectedId) return;
      void saveSelectedInternal(
        {
          globalName,
          store,
          subsView,
          selectedId,
          editorValue,
          orRangesRows,
          setStore,
          setSubsView,
          setSelectedId,
          setError,
          setIsLoading,
          dirtyRef,
          lastManualSaveAtRef,
        },
        "auto"
      );
    },
  });

  return {
    store,
    subs: subsView,

    selectedId,
    selectedItem,

    editorValue,
    setEditorValue,

    orRangesRows,
    setOrRangesRows: setOrRangesRowsAndSync,

    isLoading,
    error,

    reload,
    setSelectedId,

    createNew: () =>
      createNewSub({
        globalName,
        subsView,
        selectedId,
        editorValue,
        setSubsView,
        setStore,
        setSelectedId,
        setError,
        setIsLoading,
        dirtyRef,
      } as any),

    duplicateSelected: () =>
      duplicateSelectedSub(
        {
          globalName,
          subsView,
          selectedId,
          editorValue,
          setSubsView,
          setStore,
          setSelectedId,
          setError,
          setIsLoading,
          dirtyRef,
        } as any,
        selectedItem as any
      ),

    deleteSub: (id: string) =>
      deleteSubById(
        {
          globalName,
          subsView,
          selectedId,
          editorValue,
          setSubsView,
          setStore,
          setSelectedId,
          setError,
          setIsLoading,
          dirtyRef,
        } as any,
        id
      ),

    /**
     * ✅ FIX: si no hay sub seleccionada, "Guardar" crea una sub automáticamente
     * y luego intenta el guardado real, para que haya feedback observable (Guardado/ERROR).
     */
    saveSelected: () => {
      const ensuredId =
        selectedId ??
        createNewSub({
          globalName,
          subsView,
          selectedId,
          editorValue,
          setSubsView,
          setStore,
          setSelectedId,
          setError,
          setIsLoading,
          dirtyRef,
        } as any);

      return saveSelectedInternal(
        {
          globalName,
          store,
          subsView,
          selectedId: ensuredId,
          editorValue,
          orRangesRows,
          setStore,
          setSubsView,
          setSelectedId,
          setError,
          setIsLoading,
          dirtyRef,
          lastManualSaveAtRef,
        },
        "manual"
      );
    },

    copyPayloadJson: async () => {
      try {
        const txt = safeStringify(editorValue);
        await copyTextToClipboard(txt);
        setError("Copiado");
      } catch {
        setError("Copy ERROR");
      }
    },
  };
}
