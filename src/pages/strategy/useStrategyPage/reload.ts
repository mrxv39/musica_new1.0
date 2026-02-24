/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\pages\strategy\useStrategyPage\reload.ts
 *
 * Carga DB (dbInit + dbLoadSubs), asegura global, y hace "primer hydrate" si procede.
 */
import type { OrRangeRow, StrategyStore, SubStrategyItem, SubStrategyPayload } from "../../../strategy/types";
import { dbInit, dbLoadSubs } from "../db";
import { defaultPayload, emptyStore, ensureGlobal, listSubs } from "../state";
import { buildRows } from "../orRangesAdapter";
import { coercePayload } from "./payload";

export async function reloadFromDb(args: {
  globalName: string;
  selectedId: string | null;

  setIsLoading: (v: boolean) => void;
  setError: (v: string | null) => void;

  setStore: (s: StrategyStore) => void;
  setSubsView: (subs: SubStrategyItem[]) => void;

  setSelectedId: (id: string | null) => void;

  setEditorValue: (p: SubStrategyPayload) => void;
  setOrRangesRows: (rows: OrRangeRow[]) => void;

  dirtyRef: { current: boolean };
}): Promise<StrategyStore> {
  const {
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
  } = args;

  setIsLoading(true);
  setError(null);

  try {
    await dbInit();
    const loaded = await dbLoadSubs(globalName);
    const next = ensureGlobal(loaded ?? emptyStore(), globalName);

    setStore(next);

    const nextSubs = listSubs(next, globalName);
    setSubsView(nextSubs);

    // Primer hydrate si no hay selectedId
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
}
