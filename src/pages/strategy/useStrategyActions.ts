/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\pages\strategy\useStrategyActions.ts
 */
import { useCallback } from "react";
import type { StrategyStore, SubStrategyItem, SubStrategyPayload } from "../../strategy/types";
import { isValidPayload } from "../../strategy/substrategy_helpers";
import { dbSaveSub } from "./db";
import { defaultPayload, emptyStore, getSubById, upsertSub } from "./state";
import { getUiName, nowIso, uid } from "./model";

export function useStrategyActions(args: {
  globalName: string;

  store: StrategyStore;
  subsCount: number;

  selectedId: string | null;
  editorValue: SubStrategyPayload;

  setStore: (updater: (prev: StrategyStore) => StrategyStore) => void;
  setSelectedId: (id: string | null) => void;
  setEditorValue: (v: SubStrategyPayload) => void;
  setError: (v: string | null) => void;

  reload: () => Promise<StrategyStore>;
}) {
  const {
    globalName, store, subsCount, selectedId, editorValue,
    setStore, setSelectedId, setEditorValue, setError, reload
  } = args;

  const createNew = useCallback(() => {
    const id = uid();
    const item: SubStrategyItem = {
      ...( {} as any ),
      id,
      global: globalName,
      payload: defaultPayload(),
      // UI-only
      name: `Nueva sub ${subsCount + 1}`,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    } as any;

    setStore((prev) => {
      const cloned = structuredClone(prev ?? emptyStore());
      return upsertSub(cloned, globalName, item);
    });

    setSelectedId(id);
    setEditorValue((item as any).payload ?? defaultPayload());
  }, [globalName, subsCount, setStore, setSelectedId, setEditorValue]);

  const duplicateSelected = useCallback(() => {
    if (!selectedId) return;
    const sel = getSubById(store, globalName, selectedId);
    if (!sel) return;

    const id = uid();
    const name = getUiName(sel, "Subestrategia");
    const item: SubStrategyItem = {
      ...( {} as any ),
      id,
      global: globalName,
      payload: (sel as any).payload,
      // UI-only
      name: `${name} (copia)`,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    } as any;

    setStore((prev) => {
      const cloned = structuredClone(prev ?? emptyStore());
      return upsertSub(cloned, globalName, item);
    });

    setSelectedId(id);
    setEditorValue((item as any).payload ?? defaultPayload());
  }, [selectedId, store, globalName, setStore, setSelectedId, setEditorValue]);

  const saveSelected = useCallback(async () => {
    if (!selectedId) return;

    if (!isValidPayload(editorValue)) {
      setError("Payload inválido: revisa rangos/valores antes de guardar.");
      return;
    }

    const existing = getSubById(store, globalName, selectedId);
    const existingName = existing ? getUiName(existing, "Subestrategia") : "Subestrategia";

    const item: SubStrategyItem = {
      ...( {} as any ),
      id: selectedId,
      global: globalName,
      payload: editorValue,
      // UI-only
      name: existingName,
      createdAt: (existing as any)?.createdAt ?? nowIso(),
      updatedAt: nowIso(),
    } as any;

    try {
      await dbSaveSub(item);
      await reload();
      setSelectedId((item as any).id ?? null);
      setError(null);
    } catch (e: any) {
      const msg = e?.message ? String(e.message) : "unknown";
      setError(`DB save error: ${msg}`);
    }
  }, [selectedId, editorValue, store, globalName, reload, setSelectedId, setError]);

  return { createNew, duplicateSelected, saveSelected };
}
