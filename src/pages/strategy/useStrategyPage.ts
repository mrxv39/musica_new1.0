/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\pages\strategy\useStrategyPage.ts
 *
 * Hook "pegamento" mínimo:
 * - monta: dbInit + dbLoadSubs (via reloadFromDb)
 * - mantiene store + subsView (UI)
 * - selected: hidrata editorValue (incluye orRanges + orRangesPlan)
 * - rows UI se derivan y se sincronizan -> editorValue (fuente de verdad)
 * - autosave debounce (sin parpadeo)
 *
 * + situations:
 *   - load list from DB
 *   - create/rename/delete (con warning si tiene subs)
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { OrRangeRow, StrategyStore, SubStrategyItem, SubStrategyPayload } from "../../strategy/types";

import { dbDeleteSub, dbSaveSub, dbListSituations, dbUpsertSituation, dbRenameSituationKey, dbDeleteSituationKey, dbCountSubsForSituationKey } from "./db";
import { defaultPayload, emptyStore, ensureGlobal, getSubById, listSubs, upsertSub } from "./state";

import { buildRows, rowsToOrRanges, rowsToOrRangesPlan } from "./orRangesAdapter";

import { makeId } from "./useStrategyPage/ids";
import { upsertInArray } from "./useStrategyPage/array";
import { coercePayload } from "./useStrategyPage/payload";
import { useRowsSync } from "./useStrategyPage/rowsSync";
import { useSelectionHydration } from "./useStrategyPage/selection";
import { useAutosaveDebounce } from "./useStrategyPage/autosave";
import { reloadFromDb } from "./useStrategyPage/reload";

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

  // ✅ situations list from DB
  const [situations, setSituations] = useState<string[]>(() => []);

  // autosave refs
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
    const st = await reloadFromDb({
      globalName,
      selectedId,
      setIsLoading,
      setError,
      setStore,
      setSubsView,
      setSelectedId,
      setEditorValue,
      setOrRangesRows,
      dirtyRef,
    });

    // load situations
    try {
      const rows = await dbListSituations();
      const keys = (rows ?? []).map((r: any) => String(r?.key ?? "")).filter((k) => k.length > 0);
      setSituations(keys);

      // si la seleccion actual no existe, no forzamos nada, pero si el payload no tiene situacion válida,
      // dejamos la primera si existe
      setEditorValue((prev) => {
        const cur = String((prev as any)?.situacion ?? "");
        if (cur && keys.includes(cur)) return prev;
        if (!cur && keys.length) return { ...(prev as any), situacion: keys[0] } as any;
        return prev;
      });
    } catch (e: any) {
      // no bloqueamos el resto
      void e;
    }

    return st;
  };

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [globalName]);

  // -------- hydrate on selection ----------
  useSelectionHydration({
    selectedId,
    store,
    subsView,
    globalName,
    setEditorValue,
    setOrRangesRows,
    dirtyRef,
  });

  // -------- rows sync (editorValue <-> rows) ----------
  const { setOrRangesRowsAndSync } = useRowsSync({
    editorValue,
    setEditorValue,
    orRangesRows,
    setOrRangesRows,
  });

  // -------- situations CRUD ----------
  const refreshSituations = async () => {
    const rows = await dbListSituations();
    const keys = (rows ?? []).map((r: any) => String(r?.key ?? "")).filter((k) => k.length > 0);
    setSituations(keys);
    return keys;
  };

  const createSituation = async (key: string) => {
    setIsLoading(true);
    setError(null);
    try {
      await dbUpsertSituation(key);
      const keys = await refreshSituations();
      setEditorValue((prev) => ({ ...(prev as any), situacion: String(key).trim() }) as any);
      setError(keys.includes(String(key).trim()) ? "Situation creada" : "Situation creada");
    } catch (e: any) {
      const msg = e?.message ? String(e.message) : String(e);
      setError(`Situation CREATE ERROR: ${msg}`);
    } finally {
      setIsLoading(false);
    }
  };

  const renameSituation = async (from: string, to: string) => {
    setIsLoading(true);
    setError(null);
    try {
      await dbRenameSituationKey(from, to);
      await refreshSituations();

      // si editorValue apuntaba a la antigua, actualiza
      setEditorValue((prev) => {
        const cur = String((prev as any)?.situacion ?? "");
        if (cur === from) return { ...(prev as any), situacion: to } as any;
        return prev;
      });

      // renombra también los nombres de subsView visibles (solo display)
      setSubsView((prev) =>
        prev.map((it: any) => {
          const name = String(it?.name ?? "");
          if (name.startsWith(from + " • ")) return { ...it, name: name.replace(from + " • ", to + " • ") };
          return it;
        })
      );

      setError("Situation renombrada");
    } catch (e: any) {
      const msg = e?.message ? String(e.message) : String(e);
      setError(`Situation RENAME ERROR: ${msg}`);
    } finally {
      setIsLoading(false);
    }
  };

  const deleteSituation = async (key: string) => {
    setIsLoading(true);
    setError(null);
    try {
      // 1) preguntar count primero
      const n = await dbCountSubsForSituationKey(key);

      // 2) UI: si tiene subs, el componente hará confirm y llamará force
      // aquí solo intentamos sin force, para disparar el warning
      await dbDeleteSituationKey(key, { force: false });

      await refreshSituations();

      setEditorValue((prev) => {
        const cur = String((prev as any)?.situacion ?? "");
        if (cur === key) return { ...(prev as any), situacion: "" } as any;
        return prev;
      });

      setError(n > 0 ? "Situation borrada (y subs en cascada)" : "Situation borrada");
    } catch (e: any) {
      const msg = e?.message ? String(e.message) : String(e);

      // Este error está diseñado: SITUATION_HAS_SUBS:<n>
      if (msg.startsWith("SITUATION_HAS_SUBS:")) {
        throw e; // el UI lo gestionará (confirm)
      }

      setError(`Situation DELETE ERROR: ${msg}`);
    } finally {
      setIsLoading(false);
    }
  };

  const deleteSituationForce = async (key: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const n = await dbCountSubsForSituationKey(key);
      await dbDeleteSituationKey(key, { force: true });
      await refreshSituations();

      // tras borrar, recarga subs también (porque CASCADE)
      await reload();

      // si estabas en esa situation, limpia
      setEditorValue((prev) => {
        const cur = String((prev as any)?.situacion ?? "");
        if (cur === key) return { ...(prev as any), situacion: "" } as any;
        return prev;
      });

      setError(n > 0 ? "Situation borrada (subs eliminadas)" : "Situation borrada");
    } catch (e: any) {
      const msg = e?.message ? String(e.message) : String(e);
      setError(`Situation DELETE ERROR: ${msg}`);
    } finally {
      setIsLoading(false);
    }
  };

  // -------- CRUD subs ----------
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

  const deleteSub = async (id: string) => {
    setIsLoading(true);
    setError(null);

    try {
      await dbDeleteSub(id);

      const nextSubs = subsView.filter((s) => (s as any)?.id !== id);
      setSubsView(nextSubs);

      setStore((prev) => {
        const next = ensureGlobal(prev ?? emptyStore(), globalName) as any;
        const arr = Array.isArray(next.globals?.[globalName]?.subs) ? next.globals[globalName].subs : [];
        next.globals[globalName].subs = (arr as any[]).filter((x) => (x as any)?.id !== id);
        return next as StrategyStore;
      });

      if (selectedId === id) {
        const nextId = nextSubs[0]?.id ?? null;
        setSelectedId(nextId);

        if (!nextId) {
          const dp = defaultPayload();
          setEditorValue(dp);
          setOrRangesRows(buildRows((dp as any).orRanges, (dp as any).orRangesPlan));
          dirtyRef.current = false;
        }
      }

      setError("Eliminado");
    } catch (e: any) {
      const msg = e?.message ? String(e.message) : String(e);
      setError(`DB Delete ERROR: ${msg}`);
    } finally {
      setIsLoading(false);
    }
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
  useAutosaveDebounce({
    selectedId,
    editorValue,
    orRangesRows,
    lastManualSaveAtRef,
    autosaveTimerRef,
    dirtyRef,
    saveAuto: () => void saveSelectedInternal("auto"),
  });

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

    // ✅ situations
    situations,
    createSituation,
    renameSituation,
    deleteSituation,
    deleteSituationForce,

    isLoading,
    error,

    reload,
    setSelectedId,

    createNew,
    duplicateSelected,
    deleteSub,

    saveSelected,

    copyPayloadJson,
    exportGlobalJson,
    importGlobalJsonText,
  };
}
