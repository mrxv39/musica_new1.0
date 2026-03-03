/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\pages\strategy\useStrategyPage\useSubsCrud.ts
 */
import { useCallback } from "react";
import type { StrategyStore, SubStrategyItem } from "../../../strategy/types";

import { dbDeleteSub } from "../db";
import { defaultPayload, emptyStore, ensureGlobal, upsertSub } from "../state";
import { buildRows } from "../orRangesAdapter";

import { makeId } from "./ids";
import { upsertInArray } from "./array";
import { coercePayload } from "./payload";

type SetError = (v: string | null) => void;

export function useSubsCrud(args: {
  globalName: string;

  // state read
  selectedId: string | null;
  subsView: SubStrategyItem[];
  editorValue: any;

  // state write
  setIsLoading: (v: boolean) => void;
  setError: SetError;

  setStore: React.Dispatch<React.SetStateAction<StrategyStore>>;
  setSubsView: React.Dispatch<React.SetStateAction<SubStrategyItem[]>>;
  setSelectedId: React.Dispatch<React.SetStateAction<string | null>>;

  // editor write (clean)
  setEditorValueClean: React.Dispatch<React.SetStateAction<any>>;
  setOrRangesRows: React.Dispatch<React.SetStateAction<any[]>>;

  dirtyRef: React.MutableRefObject<boolean>;
}) {
  const {
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
  } = args;

  const createNew = useCallback(() => {
    const id = makeId();
    const name = `Auto sub ${subsView.length + 1}`;

    const p = coercePayload(editorValue);
    const rows = buildRows((p as any).orRanges, (p as any).orRangesPlan);

    const item: SubStrategyItem = {
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
  }, [editorValue, globalName, setError, setSelectedId, setStore, setSubsView, subsView.length, dirtyRef]);

  const duplicateSelected = useCallback(
    (selectedItem: SubStrategyItem | null) => {
      const base = selectedItem ?? null;

      const id = makeId();
      const name = base ? `${(base as any).name ?? "Sub"} (copy)` : `Auto sub ${subsView.length + 1}`;

      const p = coercePayload(editorValue);
      const rows = buildRows((p as any).orRanges, (p as any).orRangesPlan);

      const item: SubStrategyItem = {
        ...(base as any),
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
    },
    [editorValue, globalName, setError, setSelectedId, setStore, setSubsView, subsView.length, dirtyRef]
  );

  const deleteSub = useCallback(
    async (id: string) => {
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
          const nextId = (nextSubs as any)[0]?.id ?? null;
          setSelectedId(nextId);

          if (!nextId) {
            const dp = defaultPayload();
            setEditorValueClean(dp);
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
    },
    [
      globalName,
      selectedId,
      setEditorValueClean,
      setError,
      setIsLoading,
      setOrRangesRows,
      setSelectedId,
      setStore,
      setSubsView,
      subsView,
      dirtyRef,
    ]
  );

  return {
    createNew,
    duplicateSelected,
    deleteSub,
  };
}