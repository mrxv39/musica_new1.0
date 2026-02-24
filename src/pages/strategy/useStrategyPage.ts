/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\pages\strategy\useStrategyPage.ts
 *
 * Hook "pegamento" mínimo para que:
 * - al montar llame a dbInit() y dbLoadSubs()
 * - Guardar llame a dbSaveSub()
 *
 * FIX anti-parpadeo (2026-02-20):
 * - Autosave NO toca isLoading
 * - Autosave NO escribe en "error" (que se usa como status/toast)
 * - "error" queda para errores reales y para "Guardado en sqlite" SOLO en guardado manual
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  OrRanges,
  OrRangeRow,
  StrategyStore,
  SubStrategyItem,
  SubStrategyPayload,
  OrRangesPlan,
} from "../../strategy/types";
import { dbInit, dbLoadSubs, dbSaveSub } from "./db";
import {
  defaultPayload,
  emptyStore,
  ensureGlobal,
  getSubById,
  listSubs,
  upsertSub,
} from "./state";

const OR_KEYS = ["OR_TO_CALL_ANY", "OPEN_PUSH", "OR_TO_CALL_SMALL", "OR_TO_FOLD"] as const;

function emptyOrRanges(): OrRanges {
  return {
    OR_TO_CALL_ANY: "",
    OPEN_PUSH: "",
    OR_TO_CALL_SMALL: "",
    OR_TO_FOLD: "",
  };
}

// Utility: Convert OrRangeRow[] to OrRanges (flat)
function orRangeRowsToOrRanges(rows: OrRangeRow[] | undefined): OrRanges {
  const base = emptyOrRanges();
  if (!rows) return base;
  for (const row of rows) {
    if (
      row &&
      typeof row.id === "string" &&
      typeof row.range === "string" &&
      Object.prototype.hasOwnProperty.call(base, row.id)
    ) {
      base[row.id as keyof OrRanges] = row.range;
    }
  }
  return base;
}

// Convert OrRanges + OrRangesPlan to OrRangeRow[]
function buildOrRangeRows(orRanges: OrRanges, plan?: OrRangesPlan): OrRangeRow[] {
  return (Object.keys(orRanges) as (keyof OrRanges)[]).map((key) => {
    const p = plan?.[key];
    return {
      id: key,
      label: key,
      mode: p?.move || "OR",
      bet_min: p?.bet_min_bb ?? 0,
      bet_max: p?.bet_max_bb ?? 0,
      range: orRanges[key] ?? "",
    };
  });
}

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

export function useStrategyPage({ globalName }: { globalName: string }) {
  const [store, setStore] = useState<StrategyStore>(() => emptyStore());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editorValue, setEditorValue] = useState<SubStrategyPayload>(() => defaultPayload());

  const [orRanges, setOrRanges] = useState<OrRanges>(() => emptyOrRanges());
  const [orRangesRows, setOrRangesRows] = useState<OrRangeRow[]>(() =>
    buildOrRangeRows(emptyOrRanges())
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
    const inView = subsView.find((x: any) => (x as any)?.id === selectedId) ?? null;
    if (inView) return inView;
    return getSubById(store, globalName, selectedId);
  }, [subsView, selectedId, store, globalName]);

  useEffect(() => {
    if (!selectedId) return;
    const it =
      subsView.find((x: any) => (x as any)?.id === selectedId) ??
      getSubById(store, globalName, selectedId);
    if (!it) return;

    setEditorValue(((it as any).payload ?? defaultPayload()) as any);

    // Hydrate orRanges and orRangesRows from sub.or_ranges if present, else fallback
    const rows: OrRangeRow[] | undefined = (it as any).or_ranges;
    if (Array.isArray(rows) && rows.length > 0) {
      setOrRanges(orRangeRowsToOrRanges(rows));
      setOrRangesRows(rows);
    } else {
      // fallback: build from payload.orRanges and plan
      const p = ((it as any).payload ?? {}) as SubStrategyPayload;
      const plan = p.orRangesPlan;
      const orFlat = p.orRanges ?? emptyOrRanges();
      setOrRanges(orFlat);
      setOrRangesRows(buildOrRangeRows(orFlat, plan));
    }

    dirtyRef.current = false;
  }, [selectedId, store, globalName, subsView]);

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
        setSelectedId(nextSubs[0].id);
        setEditorValue((nextSubs[0] as any).payload ?? defaultPayload());

        // keep existing persisted rows if present, else build from payload
        const rows: OrRangeRow[] | undefined = (nextSubs[0] as any).or_ranges;
        if (Array.isArray(rows) && rows.length > 0) {
          setOrRanges(orRangeRowsToOrRanges(rows));
          setOrRangesRows(rows);
        } else {
          const p = ((nextSubs[0] as any).payload ?? {}) as SubStrategyPayload;
          const orFlat = p.orRanges ?? emptyOrRanges();
          setOrRanges(orFlat);
          setOrRangesRows(buildOrRangeRows(orFlat, p.orRangesPlan));
        }
      } else if (!selectedId) {
        setEditorValue(defaultPayload());
        setOrRanges(emptyOrRanges());
        setOrRangesRows(buildOrRangeRows(emptyOrRanges()));
      }

      return next;
    } catch (e: any) {
      const msg = e?.message ? String(e.message) : String(e);
      setError(`DB LOAD ERROR: ${msg}`);
      const fallback = ensureGlobal(emptyStore(), globalName);
      setStore(fallback);
      setSubsView(listSubs(fallback, globalName));
      setEditorValue(defaultPayload());
      setOrRanges(emptyOrRanges());
      setOrRangesRows(buildOrRangeRows(emptyOrRanges()));
      return fallback;
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [globalName]);

  const createNew = () => {
    const id = makeId();
    const name = `Auto sub ${subsView.length + 1}`;
    const item: SubStrategyItem = {
      id,
      name,
      payload: editorValue,
      or_ranges: orRangesRows,
    } as any;

    setSubsView((prev) => upsertInArray(prev, item));
    setStore((prev) => {
      const base = ensureGlobal(prev ?? emptyStore(), globalName);
      return upsertSub(base, globalName, item);
    });

    setSelectedId(id);
    setError(null);
  };

  const duplicateSelected = () => {
    if (!selectedItem) {
      createNew();
      return;
    }
    const id = makeId();
    const name = `${(selectedItem as any).name ?? "Sub"} (copy)`;
    const item: SubStrategyItem = {
      ...(selectedItem as any),
      id,
      name,
      payload: editorValue,
      or_ranges: orRangesRows,
    } as any;

    setSubsView((prev) => upsertInArray(prev, item));
    setStore((prev) => {
      const base = ensureGlobal(prev ?? emptyStore(), globalName);
      return upsertSub(base, globalName, item);
    });

    setSelectedId(id);
    setError(null);
  };

  const saveSelectedInternal = async (mode: "manual" | "auto") => {
    // ✅ solo "loading" en guardado manual (el autosave no debe parpadear UI)
    if (mode === "manual") {
      setIsLoading(true);
      setError(null);
    }

    try {
      const id = selectedId ?? makeId();
      const existing =
        (id ? subsView.find((x: any) => (x as any)?.id === id) : null) ??
        (id ? getSubById(store, globalName, id) : null);

      const item: SubStrategyItem = {
        id,
        name: (existing as any)?.name ?? `Auto sub ${subsView.length + 1}`,
        payload: editorValue,
        or_ranges: orRangesRows,
      } as any;

      await dbSaveSub({ ...(item as any), globalName });

      // actualizar vistas en memoria
      setSubsView((prev) => upsertInArray(prev, item));

      setStore((prev) => {
        const base = ensureGlobal(prev ?? emptyStore(), globalName);
        return upsertSub(base, globalName, item);
      });

      if (!selectedId) setSelectedId(id);

      dirtyRef.current = false;

      if (mode === "manual") {
        lastManualSaveAtRef.current = Date.now();
        setError("Guardado en sqlite");
      }
      // ✅ en autosave NO seteamos error/status
    } catch (e: any) {
      const msg = e?.message ? String(e.message) : String(e);
      setError(`DB Save ERROR: ${msg}`);
    } finally {
      if (mode === "manual") setIsLoading(false);
    }
  };

  const saveSelected = async () => saveSelectedInternal("manual");

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
  }, [editorValue, orRanges, orRangesRows, selectedId]);

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

      setSubsView(listSubs(next, globalName));
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

    orRanges,
    setOrRanges,
    orRangesRows,
    setOrRangesRows,

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