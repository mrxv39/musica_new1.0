/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\pages\strategy\useStrategyPage_refactor\crud.ts
 */
import type React from "react";
import type { StrategyStore, SubStrategyItem, SubStrategyPayload } from "../../../strategy/types";

import { emptyStore, ensureGlobal, upsertSub } from "../state";
import { buildRows } from "../orRangesAdapter";
import { makeId } from "../useStrategyPage/ids";
import { upsertInArray } from "../useStrategyPage/array";
import { coercePayload } from "../useStrategyPage/payload";
import { removeSubFromStore } from "./state";
import { dbDeleteSub } from "../db";

type SetState<T> = React.Dispatch<React.SetStateAction<T>>;

export type CrudDeps = {
  globalName: string;
  subsView: SubStrategyItem[];
  selectedId: string | null;
  editorValue: SubStrategyPayload;

  setSubsView: SetState<SubStrategyItem[]>;
  setStore: SetState<StrategyStore>;
  setSelectedId: SetState<string | null>;
  setError: SetState<string | null>;
  setIsLoading: SetState<boolean>;

  dirtyRef: React.MutableRefObject<boolean>;
};

function upsertLocal(deps: CrudDeps, item: SubStrategyItem) {
  deps.setSubsView((prev) => upsertInArray(prev, item));
  deps.setStore((prev) => upsertSub(ensureGlobal(prev ?? emptyStore(), deps.globalName), deps.globalName, item));
}

/**
 * Crea una sub local y la selecciona.
 * Devuelve el id creado para poder encadenar acciones (ej: Guardar inmediatamente).
 */
export function createNewSub(deps: CrudDeps): string {
  const id = makeId();
  const name = `Auto sub ${deps.subsView.length + 1}`;

  const p = coercePayload(deps.editorValue);
  const rows = buildRows((p as any).orRanges, (p as any).orRangesPlan);

  const item: SubStrategyItem = { id: String(id), name, payload: p, or_ranges: rows as any } as any;

  upsertLocal(deps, item);
  deps.setSelectedId(String(id));
  deps.setError(null);
  deps.dirtyRef.current = true;

  return String(id);
}

export function duplicateSelectedSub(deps: CrudDeps, selectedItem: SubStrategyItem | null): string {
  if (!selectedItem) return createNewSub(deps);

  const id = makeId();
  const name = `${(selectedItem as any).name ?? "Sub"} (copy)"`.replace(')"', ")"); // keep name stable if lint complains

  const p = coercePayload(deps.editorValue);
  const rows = buildRows((p as any).orRanges, (p as any).orRangesPlan);

  const item: SubStrategyItem = { ...(selectedItem as any), id: String(id), name, payload: p, or_ranges: rows as any } as any;

  upsertLocal(deps, item);
  deps.setSelectedId(String(id));
  deps.setError(null);
  deps.dirtyRef.current = true;

  return String(id);
}

export async function deleteSubById(deps: CrudDeps, id: string) {
  deps.setIsLoading(true);
  deps.setError(null);

  try {
    if (/^db_\d+$/.test(String(id))) {
      await dbDeleteSub(String(id));
    }

    deps.setSubsView((prev) => prev.filter((x: any) => String((x as any)?.id) !== String(id)));
    deps.setStore((prev) => removeSubFromStore(prev ?? emptyStore(), deps.globalName, String(id)));

    if (deps.selectedId === id) deps.setSelectedId(null);

    deps.dirtyRef.current = false;
    deps.setError("Borrado");
  } catch (e: any) {
    const msg = e?.message ? String(e.message) : String(e);
    deps.setError(`DB Delete ERROR: ${msg}`);
  } finally {
    deps.setIsLoading(false);
  }
}
