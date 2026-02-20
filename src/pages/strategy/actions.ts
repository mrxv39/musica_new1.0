/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\pages\strategy\actions.ts
 */
import type { StrategyGlobal } from "../../strategy/constants";
import type { StrategyStore, SubStrategyItem, SubStrategyPayload } from "../../strategy/types";
import { ensureGlobal, upsertSub, deleteSub, listSubs } from "../../strategy/store";
import { makeSubId, computeSituacionFromPositions, normalizePayload } from "../../strategy/utils";
import { isValidPayload } from "../../strategy/substrategy_helpers";
import { defaultPayload, emptyStore } from "./defaults";
import { dbSaveSub } from "./db";

export function createStrategyActions(args: {
  getStore: () => StrategyStore;
  setStore: (s: StrategyStore) => void;
  getGlobal: () => StrategyGlobal;
  getSelectedId: () => string | null;
  setSelectedId: (id: string | null) => void;
  getPayload: () => SubStrategyPayload;
  setPayload: (p: SubStrategyPayload) => void;
  setStatus: (s: string) => void;
  refreshFromDB: (g?: StrategyGlobal) => Promise<void>;
}) {
  const {
    getStore,
    setStore,
    getGlobal,
    getSelectedId,
    setSelectedId,
    getPayload,
    setPayload,
    setStatus,
    refreshFromDB,
  } = args;

  function getSubs(): SubStrategyItem[] {
    return listSubs(getStore(), getGlobal());
  }

  function getGenerated(): SubStrategyItem {
    const p0 = normalizePayload(getPayload());
    const p: SubStrategyPayload = { ...p0 };
    p.situacion = computeSituacionFromPositions(p.hero_pos, p.p2_pos, p.p3_pos);
    return { id: makeSubId(p), payload: p };
  }

  const onNew = () => {
    setSelectedId(null);
    setPayload(defaultPayload());
    setStatus("Nuevo: editor limpio.");
  };

  const onSelect = (id: string) => {
    const subs = getSubs();
    const it = subs.find((x) => x.id === id);
    if (!it) return;
    setSelectedId(it.id);
    setPayload(normalizePayload(it.payload));
  };

  const onSave = async () => {
    try {
      const generated = getGenerated();
      if (!isValidPayload(generated.payload)) {
        setStatus("DB Save ERROR: payload inválido (campos undefined/null)");
        return;
      }

      const { situationKey, bucket } = await dbSaveSub(generated);
      setStatus(`Guardado en SQLite: ${situationKey} / ${bucket}`);

      await refreshFromDB(getGlobal());
      setSelectedId(generated.id);
    } catch (e: any) {
      setStatus(`DB Save ERROR: ${e?.message || String(e)}`);
    }
  };

  const onDelete = () => {
    const selectedId = getSelectedId();
    if (!selectedId) {
      setStatus("Selecciona una subestrategia para borrar.");
      return;
    }
    const subs = getSubs();
    const idx = subs.findIndex((x) => x.id === selectedId);
    if (idx < 0) return;

    const nextStore: StrategyStore = { ...(getStore() || emptyStore()) };
    ensureGlobal(nextStore, getGlobal());
    deleteSub(nextStore, getGlobal(), idx);
    setStore(nextStore);

    setSelectedId(null);
    setStatus("Subestrategia borrada (UI).");
  };

  const onDuplicate = () => {
    const selectedId = getSelectedId();
    const subs = getSubs();

    const base = selectedId ? subs.find((x) => x.id === selectedId) : null;
    const src = base ?? getGenerated();

    const p0 = normalizePayload(src.payload);
    const p: SubStrategyPayload = { ...p0 };
    p.situacion = computeSituacionFromPositions(p.hero_pos, p.p2_pos, p.p3_pos);

    const newItem: SubStrategyItem = { id: makeSubId(p) + `|copy:${Date.now()}`, payload: p };

    const nextStore: StrategyStore = { ...(getStore() || emptyStore()) };
    ensureGlobal(nextStore, getGlobal());
    upsertSub(nextStore, getGlobal(), newItem);
    setStore(nextStore);

    setSelectedId(newItem.id);
    setPayload(p);
    setStatus("Duplicada (UI). Pulsa Guardar para persistir en DB.");
  };

  const onCopyJson = async () => {
    try {
      const generated = getGenerated();
      await navigator.clipboard.writeText(JSON.stringify(generated, null, 2));
      setStatus("Copiado al portapapeles (item).");
    } catch {
      setStatus("No pude copiar (permiso).");
    }
  };

  const onExportStore = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(getStore(), null, 2));
      setStatus("Copiado al portapapeles (STORE).");
    } catch {
      setStatus("No pude copiar (permiso).");
    }
  };

  const onImportStore = () => {
    const raw = window.prompt("Pega aquí el STORE (JSON) para importar/reescribir:");
    if (raw === null) return;
    try {
      const obj = JSON.parse(raw);
      if (!obj || typeof obj !== "object") throw new Error("JSON inválido");
      setStore(obj as StrategyStore);
      setSelectedId(null);
      setStatus("Import OK (store reemplazado).");
    } catch (e: any) {
      setStatus(`Import ERROR: ${e?.message || String(e)}`);
    }
  };

  return {
    onNew,
    onSave,
    onDelete,
    onDuplicate,
    onSelect,
    onCopyJson,
    onExportStore,
    onImportStore,
    getGenerated,
  };
}
