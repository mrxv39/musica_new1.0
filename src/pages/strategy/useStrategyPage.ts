/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\pages\strategy\useStrategyPage.ts
 *
 * Hook "pegamento" mínimo:
 * - monta: dbInit + dbLoadSubs
 * - mantiene store + subsView (UI)
 * - selected: hidrata editorValue (incluye orRanges + orRangesPlan)
 * - rows UI se derivan y se sincronizan -> editorValue (fuente de verdad)
 * - autosave debounce (sin parpadeo)
 *
 * Importante:
 * - Persistencia real: dbSaveSub usa payload.orRangesPlan y or_ranges (ranges) para columnas
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { OrRangeRow, StrategyStore, SubStrategyItem, SubStrategyPayload } from "../../strategy/types";
import { dbInit, dbLoadSubs, dbSaveSub } from "./db";
import { defaultPayload, emptyStore, ensureGlobal, getSubById, listSubs, upsertSub } from "./state";
import { normalizePayload } from "../../strategy/utils";
import {
  buildRows,
  rowsToOrRanges,
  rowsToOrRangesPlan,
  isSameRows,
} from "./orRangesAdapter";

function makeId() {
  return `sub_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

function upsertInArray(arr: SubStrategyItem[], item: SubStrategyItem): SubStrategyItem[] {
  const idx = arr.findIndex((x: any) => (x as any)?.id === (item as any)?.id);
  if (idx >= 0) {
    const next = arr.slice();
    next[idx] = item;
    return next;
  }
  return [...arr, item];
}

function coercePayload(p: any): SubStrategyPayload {
  try {
    return normalizePayload((p ?? defaultPayload()) as SubStrategyPayload);
  } catch {
    return defaultPayload();
  }
}

export function useStrategyPage({ globalName }: { globalName: string }) {
  const [store, setStore] = useState<StrategyStore>(() => emptyStore());
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // ✅ fuente de verdad de persistencia
  const [editorValue, setEditorValue] = useState<SubStrategyPayload>(() => defaultPayload());

  // ✅ estado UI de filas (inputs estables)
  const [orRangesRows, setOrRangesRows] = useState<OrRangeRow[]>(() =>
    buildRows((defaultPayload() as any).orRanges, (defaultPayload() as any).orRangesPlan)
  );

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subsView, setSubsView] = useState<SubStrategyItem[]>(() => []);

  // autosave
  const lastManualSaveAtRef = useRef<number>(Number.NEGATIVE_INFINITY);
  const autosaveTimerRef = useRef<number | null>(null);
  const dirtyRef = useRef<boolean>(false);

  const subs = subsView;

  const selectedItem = useMemo(() => {
    if (!selectedId) return null;
    return subsView.find((x: any) => (x as any)?.id === selectedId) ?? getSubById(store, globalName, selectedId);
  }, [subsView, selectedId, store, globalName]);

  // -------- load/reload ----------
  const reload = async (): Promise<StrategyStore> => {
    setIsLoading(true);
    setError(null);
    try {
      await dbInit();
      const loaded = await dbLoadSubs(globalName);
      const next = ensureGlobal(loaded ?? emptyStore(), globalName);

      setStore(next);

      const nextSubs = listSubs(next, globalName);
      setSubsView(nextSubs);

      if (!selectedId && nextSubs.length > 0) {
        const first = nextSubs[0] as any;
        setSelectedId(first.id);

        const p = coercePayload(first.payload);
        setEditorValue(p);

        const rows = buildRows((p as any).orRanges, (p as any).orRangesPlan);
        setOrRangesRows(rows);

        dirtyRef.current = false;
      }

      if (!selectedId && nextSubs.length === 0) {
        const p = defaultPayload();
        setEditorValue(p);
        setOrRangesRows(buildRows((p as any).orRanges, (p as any).orRangesPlan));
        dirtyRef.current = false;
      }

      return next;
    } catch (e: any) {
      const msg = e?.message ? String(e.message) : String(e);
      setError(`DB LOAD ERROR: ${msg}`);

      const fallback = ensureGlobal(emptyStore(), globalName);
      setStore(fallback);

      const p = defaultPayload();
      setEditorValue(p);
      setOrRangesRows(buildRows((p as any).orRanges, (p as any).orRangesPlan));
      setSubsView(listSubs(fallback, globalName));

      dirtyRef.current = false;
      return fallback;
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [globalName]);

  // -------- hydrate on selection ----------
  useEffect(() => {
    if (!selectedId) return;

    const it =
      subsView.find((x: any) => (x as any)?.id === selectedId) ?? getSubById(store, globalName, selectedId);
    if (!it) return;

    const p = coercePayload((it as any).payload);
    setEditorValue(p);

    const rows = buildRows((p as any).orRanges, (p as any).orRangesPlan);
    setOrRangesRows(rows);

    dirtyRef.current = false;
  }, [selectedId, store, globalName, subsView]);

  // -------- keep rows in sync if editorValue changes via import/reload ----------
  useEffect(() => {
    const desired = buildRows((editorValue as any).orRanges, (editorValue as any).orRangesPlan);
    if (!isSameRows(orRangesRows, desired)) {
      setOrRangesRows(desired);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorValue]);

  // -------- row edits -> update editorValue (single source of truth) ----------
  const setOrRangesRowsAndSync = (rows: OrRangeRow[]) => {
    setOrRangesRows(rows);

    const nextOrRanges = rowsToOrRanges(rows);
    const nextPlan = rowsToOrRangesPlan(rows);

    setEditorValue((prev) => coercePayload({ ...(prev as any), orRanges: nextOrRanges, orRangesPlan: nextPlan }));
  };

  // -------- CRUD ----------
  const createNew = () => {
    const id = makeId();
    const name = `Auto sub ${subsView.length + 1}`;

    const p = coercePayload(editorValue);
    const rows = buildRows((p as any).orRanges, (p as any).orRangesPlan);

    const item: SubStrategyItem = {
      id,
      name,
      payload: p,
      // dbSaveSub acepta obj o rows: le pasamos rows para que columnas salgan de range
      or_ranges: rows as any,
    } as any;

    setSubsView((prev) => upsertInArray(prev, item));
    setStore((prev) => upsertSub(ensureGlobal(prev ?? emptyStore(), globalName), globalName, item));

    setSelectedId(id);
    setError(null);

    dirtyRef.current = true;
  };

  const duplicateSelected = () => {
    if (!selectedItem) {
      createNew();
      return;
    }

    const id = makeId();
    const name = `${(selectedItem as any).name ?? "Sub"} (copy)`;

    const p = coercePayload(editorValue);
    const rows = buildRows((p as any).orRanges, (p as any).orRangesPlan);

    const item: SubStrategyItem = {
      ...(selectedItem as any),
      id,
      name,
      payload: p,
      or_ranges: rows as any,
    } as any;

    setSubsView((prev) => upsertInArray(prev, item));
    setStore((prev) => upsertSub(ensureGlobal(prev ?? emptyStore(), globalName), globalName, item));

    setSelectedId(id);
    setError(null);

    dirtyRef.current = true;
  };

  // -------- SAVE (manual/auto) ----------
  const saveSelectedInternal = async (mode: "manual" | "auto") => {
    if (mode === "manual") {
      setIsLoading(true);
      setError(null);
    }

    try {
      const id = selectedId ?? makeId();
      const existing =
        (id ? subsView.find((x: any) => (x as any)?.id === id) : null) ?? (id ? getSubById(store, globalName, id) : null);

      const p = coercePayload(editorValue);

      // rows de UI -> ranges+plan (por si acaso hay desync)
      const rows = orRangesRows;
      const orRanges = rowsToOrRanges(rows);
      const orRangesPlan = rowsToOrRangesPlan(rows);

      const payloadToSave = coercePayload({ ...(p as any), orRanges, orRangesPlan });

      const item: SubStrategyItem = {
        id,
        name: (existing as any)?.name ?? `Auto sub ${subsView.length + 1}`,
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
      const msg = e?.message ? String(e.message) : String(e);
      setError(`DB Save ERROR: ${msg}`);
    } finally {
      if (mode === "manual") setIsLoading(false);
    }
  };

  const saveSelected = async () => saveSelectedInternal("manual");

  // autosave debounce
  useEffect(() => {
    if (!selectedId) return;

    const now = Date.now();
    if (now - lastManualSaveAtRef.current < 500) return;

    dirtyRef.current = true;

    if (autosaveTimerRef.current) {
      window.clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }

    autosaveTimerRef.current = window.setTimeout(() => {
      if (!dirtyRef.current) return;
      void saveSelectedInternal("auto");
    }, 650);

    return () => {
      if (autosaveTimerRef.current) {
        window.clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorValue, orRangesRows, selectedId]);

  // -------- misc ----------
  const copyPayloadJson = async () => {
    try {
      const text = JSON.stringify(editorValue ?? {}, null, 2);
      await navigator.clipboard.writeText(text);
      setError("Copiado");
    } catch {
      setError("Copy ERROR");
    }
  };

  const exportGlobalJson = () => {
    try {
      const data = JSON.stringify(store ?? {}, null, 2);
      void data;
      setError("Export OK");
    } catch {
      setError("Export ERROR");
    }
  };

  const importGlobalJsonText = async (jsonText: string) => {
    try {
      const parsed = JSON.parse(jsonText || "{}");
      const next = ensureGlobal(parsed as StrategyStore, globalName);
      setStore(next);

      const nextSubs = listSubs(next, globalName);
      setSubsView(nextSubs);

      setError("Import OK");
    } catch (e: any) {
      const msg = e?.message ? String(e.message) : String(e);
      setError(`Import ERROR: ${msg}`);
    }
  };

  return {
    store,
    subs,

    selectedId,
    selectedItem,

    editorValue,
    setEditorValue,

    // ✅ rows controlados (UI)
    orRangesRows,
    setOrRangesRows: setOrRangesRowsAndSync,

    isLoading,
    error,

    reload,
    setSelectedId,

    createNew,
    duplicateSelected,

    saveSelected,

    copyPayloadJson,
    exportGlobalJson,
    importGlobalJsonText,
  };
}
