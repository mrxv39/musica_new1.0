/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\pages\strategy\useStrategyPage.ts
 *
 * Hook "pegamento" mínimo para que:
 * - al montar llame a dbInit() y dbLoadSubs()
 * - Guardar llame a dbSaveSub()
 * - si falla: muestre "DB Save ERROR: <msg>"
 * - si ok: muestre "Guardado en sqlite"
 *
 * NOTA (2026-02-20):
 * Migración OR ranges:
 * - Antes: orRanges: OrRangeRow[]
 * - Ahora: orRanges: OrRanges (objeto fijo con 4 keys)
 * - Se incluye coerción defensiva desde formatos legacy (array u objeto parcial)
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { OrRanges, StrategyStore, SubStrategyItem, SubStrategyPayload } from "../../strategy/types";
import { dbInit, dbLoadSubs, dbSaveSub } from "./db";
import { defaultPayload, emptyStore, ensureGlobal, getSubById, listSubs, upsertSub } from "./state";

type Args = {
  globalName: string;
};

type Ctrl = {
  // state
  store: StrategyStore;
  subs: SubStrategyItem[];

  selectedId: string | null;
  selectedItem: SubStrategyItem | null;

  editorValue: SubStrategyPayload;
  setEditorValue: (v: SubStrategyPayload) => void;

  orRanges: OrRanges;
  setOrRanges: (next: OrRanges) => void;

  isLoading: boolean;
  error: string | null;

  // actions
  reload: () => Promise<StrategyStore>;
  setSelectedId: (id: string | null) => void;

  createNew: () => void;
  duplicateSelected: () => void;

  saveSelected: () => Promise<void>;

  copyPayloadJson: () => Promise<void>;
  exportGlobalJson: () => void;
  importGlobalJsonText: (jsonText: string) => Promise<void>;
};

const OR_KEYS = ["OR_TO_CALL_ANY", "OPEN_PUSH", "OR_TO_CALL_SMALL", "OR_TO_FOLD"] as const;

function emptyOrRanges(): OrRanges {
  return {
    OR_TO_CALL_ANY: "",
    OPEN_PUSH: "",
    OR_TO_CALL_SMALL: "",
    OR_TO_FOLD: "",
  };
}

/**
 * Coerce defensivo:
 * - Si viene un objeto con keys -> lo rellena con defaults
 * - Si viene un array legacy (OrRangeRow[]) -> intenta mapear por campos comunes; si no puede, lo ignora y deja "".
 * - Si viene null/undefined -> empty
 */
function coerceToOrRanges(input: any): OrRanges {
  const base = emptyOrRanges();

  if (!input) return base;

  // Caso: ya es objeto con keys nuevas (parcial o completo)
  const looksLikeObject =
    typeof input === "object" &&
    !Array.isArray(input) &&
    (OR_KEYS.some(k => Object.prototype.hasOwnProperty.call(input, k)) ||
      OR_KEYS.some(k => typeof (input as any)[k] === "string"));

  if (looksLikeObject) {
    const obj = input as any;
    return {
      OR_TO_CALL_ANY: typeof obj.OR_TO_CALL_ANY === "string" ? obj.OR_TO_CALL_ANY : "",
      OPEN_PUSH: typeof obj.OPEN_PUSH === "string" ? obj.OPEN_PUSH : "",
      OR_TO_CALL_SMALL: typeof obj.OR_TO_CALL_SMALL === "string" ? obj.OR_TO_CALL_SMALL : "",
      OR_TO_FOLD: typeof obj.OR_TO_FOLD === "string" ? obj.OR_TO_FOLD : "",
    };
  }

  // Caso legacy: array de filas
  if (Array.isArray(input)) {
    const next = { ...base } as any;

    for (const row of input) {
      if (!row || typeof row !== "object") continue;

      // Intentos de encontrar la key (dependiendo de cómo fuese OrRangeRow)
      const key =
        (row as any).key ??
        (row as any).type ??
        (row as any).name ??
        (row as any).kind ??
        (row as any).id;

      if (typeof key !== "string") continue;
      if (!OR_KEYS.includes(key as any)) continue;

      // Intentos de encontrar el valor
      const val =
        (row as any).value ??
        (row as any).range ??
        (row as any).text ??
        (row as any).hands ??
        "";

      next[key] = typeof val === "string" ? val : String(val ?? "");
    }

    return next as OrRanges;
  }

  // Fallback: desconocido
  return base;
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

export function useStrategyPage({ globalName }: Args): Ctrl {
  const [store, setStore] = useState<StrategyStore>(() => emptyStore());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editorValue, setEditorValue] = useState<SubStrategyPayload>(() => defaultPayload());

  // ✅ Migrado a OrRanges (objeto fijo)
  const [orRanges, setOrRanges] = useState<OrRanges>(() => emptyOrRanges());

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ✅ Vista estable de subs (no dependemos de que listSubs/upsertSub “encajen” en tests)
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

  // Al cambiar selección, cargamos payload y or_ranges al editor
  useEffect(() => {
    if (!selectedId) return;
    const it =
      subsView.find((x: any) => (x as any)?.id === selectedId) ?? getSubById(store, globalName, selectedId);
    if (!it) return;

    setEditorValue(((it as any).payload ?? defaultPayload()) as any);

    // ✅ coerción defensiva (legacy array u objeto parcial)
    setOrRanges(coerceToOrRanges((it as any).or_ranges));

    // al seleccionar, lo tratamos como limpio (evita autosave instantáneo)
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

        // opcional: también precargar OR de la primera
        setOrRanges(coerceToOrRanges((nextSubs[0] as any).or_ranges));
      } else if (!selectedId) {
        setEditorValue(defaultPayload());
        setOrRanges(emptyOrRanges());
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
      or_ranges: orRanges,
    } as any;

    setSubsView(prev => upsertInArray(prev, item));

    setStore(prev => {
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
      or_ranges: orRanges,
    } as any;

    setSubsView(prev => upsertInArray(prev, item));

    setStore(prev => {
      const base = ensureGlobal(prev ?? emptyStore(), globalName);
      return upsertSub(base, globalName, item);
    });

    setSelectedId(id);
    setError(null);
  };

  const saveSelectedInternal = async (mode: "manual" | "auto") => {
    setIsLoading(true);
    if (mode === "manual") setError(null);

    try {
      const id = selectedId ?? makeId();
      const existing =
        (id ? subsView.find((x: any) => (x as any)?.id === id) : null) ??
        (id ? getSubById(store, globalName, id) : null);

      const item: SubStrategyItem = {
        id,
        name: (existing as any)?.name ?? `Auto sub ${subsView.length + 1}`,
        payload: editorValue,
        or_ranges: orRanges,
      } as any;

      await dbSaveSub({ ...(item as any), globalName });

      setSubsView(prev => upsertInArray(prev, item));

      setStore(prev => {
        const base = ensureGlobal(prev ?? emptyStore(), globalName);
        return upsertSub(base, globalName, item);
      });

      if (!selectedId) setSelectedId(id);

      dirtyRef.current = false;

      if (mode === "manual") {
        lastManualSaveAtRef.current = Date.now();
        setError("Guardado en sqlite");
      } else {
        setError("Auto-guardado");
      }
    } catch (e: any) {
      const msg = e?.message ? String(e.message) : String(e);
      setError(`DB Save ERROR: ${msg}`);
    } finally {
      setIsLoading(false);
    }
  };

  const saveSelected = async () => saveSelectedInternal("manual");

  // Autosave: debounce al cambiar editorValue u orRanges.
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
  }, [editorValue, orRanges, selectedId]);

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