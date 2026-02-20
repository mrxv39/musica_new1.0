/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\pages\strategy\useStrategyActions.ts
 *
 * Acciones estables:
 * - Guardar/autosave: escribe en DB pero NO recarga toda la lista.
 * - Actualiza store en memoria con upsertSub => sidebar se actualiza sin resetear editor.
 */
import { useCallback, useRef, useState } from "react";
import type { StrategyStore, SubStrategyItem, SubStrategyPayload, OrRanges } from "../../strategy/types";
import { ensureGlobal, upsertSub, deleteSub, listSubs } from "../../strategy/store";
import { normalizePayload, makeSubId } from "../../strategy/utils";
import { dbSaveSub } from "./db";

export type SaveStatus = "idle" | "saving" | "ok" | "error";

const DEFAULT_OR: OrRanges = {
  OR_TO_CALL_ANY: "",
  OPEN_PUSH: "",
  OR_TO_CALL_SMALL: "",
  OR_TO_FOLD: "",
};

export type UseStrategyActionsArgs = {
  globalName: string;
  store: StrategyStore;
  setStore: (s: StrategyStore) => void;

  activeId: string;
  setActiveId: (id: string) => void;

  payload: SubStrategyPayload | null;
  setPayload: (p: SubStrategyPayload | null) => void;

  orRanges: OrRanges;
  setOrRanges: (r: OrRanges) => void;

  // Para elegir el primero cuando borras y te quedas sin activo
  onSelectItem?: (item: SubStrategyItem | null) => void;
};

function toNumericId(id: string): number | null {
  // soporta ids tipo "db_123"
  const m = String(id || "").match(/(\d+)/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

export function useStrategyActions(args: UseStrategyActionsArgs) {
  const {
    globalName,
    store,
    setStore,
    activeId,
    setActiveId,
    payload,
    setPayload,
    orRanges,
    setOrRanges,
    onSelectItem,
  } = args;

  const [status, setStatus] = useState<SaveStatus>("idle");
  const [statusMsg, setStatusMsg] = useState("");

  const autosaveTimer = useRef<any>(null);

  const makeCurrentItem = useCallback((): SubStrategyItem | null => {
    if (!payload) return null;
    const p = normalizePayload(payload);
    const id = activeId || makeSubId(p);
    const item: any = { id, payload: p, or_ranges: { ...DEFAULT_OR, ...(orRanges || {}) } };
    return item as SubStrategyItem;
  }, [payload, activeId, orRanges]);

  const save = useCallback(async () => {
    const item = makeCurrentItem();
    if (!item) return;

    setStatus("saving");
    setStatusMsg("");

    try {
      await dbSaveSub(item as any);

      // ✅ actualizar store en memoria (sin reload)
      const next: StrategyStore = { ...store };
      ensureGlobal(next, globalName as any);
      upsertSub(next as any, globalName as any, item);
      setStore(next);

      setActiveId(item.id);

      setStatus("ok");
      setStatusMsg("Guardado en SQLite");
    } catch (e: any) {
      setStatus("error");
      setStatusMsg(String(e?.message || e));
    }
  }, [makeCurrentItem, store, setStore, globalName, setActiveId]);

  const scheduleAutosave = useCallback(() => {
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      save();
    }, 600);
  }, [save]);

  const newSub = useCallback(() => {
    setActiveId("");
    setStatus("idle");
    setStatusMsg("");

    if (payload) setPayload(normalizePayload({ ...(payload as any) }));
    setOrRanges({ ...DEFAULT_OR });
  }, [payload, setPayload, setOrRanges, setActiveId]);

  const duplicate = useCallback(() => {
    setActiveId("");
    setStatus("idle");
    setStatusMsg("");
    if (payload) setPayload(normalizePayload({ ...(payload as any) }));
    setOrRanges({ ...DEFAULT_OR, ...(orRanges || {}) });
  }, [payload, orRanges, setPayload, setOrRanges, setActiveId]);

  const remove = useCallback(() => {
    if (!activeId) return;

    const numId = toNumericId(activeId);
    if (numId == null) {
      // si no es numérico, solo limpiamos UI
      setActiveId("");
      setPayload(null);
      setOrRanges({ ...DEFAULT_OR });
      setStatus("idle");
      setStatusMsg("");
      return;
    }

    const next: StrategyStore = { ...store };
    ensureGlobal(next, globalName as any);

    // deleteSub espera number (id db)
    deleteSub(next as any, globalName as any, numId);
    setStore(next);

    // Seleccionar el primero si existe
    const g = ensureGlobal(next, globalName as any);
    const subs = listSubs(g as any, globalName as any);
    const first = subs.length ? subs[0] : null;
    onSelectItem?.(first);

    setStatus("idle");
    setStatusMsg("");
  }, [activeId, store, setStore, globalName, onSelectItem, setActiveId, setPayload, setOrRanges]);

  return {
    status,
    statusMsg,

    save,
    scheduleAutosave,

    newSub,
    duplicate,
    remove,
  };
}
