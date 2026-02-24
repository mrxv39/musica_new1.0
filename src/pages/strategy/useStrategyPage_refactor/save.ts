import type { OrRangeRow, StrategyStore, SubStrategyItem, SubStrategyPayload } from "../../../strategy/types";
import { emptyStore, ensureGlobal, getSubById, upsertSub } from "../state";
import { rowsToOrRanges, rowsToOrRangesPlan } from "../orRangesAdapter";
import { upsertInArray } from "../useStrategyPage/array";
import { coercePayload } from "../useStrategyPage/payload";
import { dbSaveSub } from "../db";

type SetState<T> = React.Dispatch<React.SetStateAction<T>>;

export type SaveDeps = {
  globalName: string;

  store: StrategyStore;
  subsView: SubStrategyItem[];
  selectedId: string | null;

  editorValue: SubStrategyPayload;
  orRangesRows: OrRangeRow[];

  setStore: SetState<StrategyStore>;
  setSubsView: SetState<SubStrategyItem[]>;
  setSelectedId: SetState<string | null>;
  setError: SetState<string | null>;
  setIsLoading: SetState<boolean>;

  dirtyRef: React.MutableRefObject<boolean>;
  lastManualSaveAtRef: React.MutableRefObject<number>;
};

export async function saveSelectedInternal(deps: SaveDeps, mode: "manual" | "auto") {
  if (!deps.selectedId) {
    if (mode === "manual") deps.setError("Primero crea o selecciona una subestrategia (Nuevo / Duplicar).");
    return;
  }

  if (mode === "manual") {
    deps.setIsLoading(true);
    deps.setError(null);
  }

  try {
    const id = deps.selectedId;

    const existing =
      (id ? deps.subsView.find((x: any) => (x as any)?.id === id) : null) ??
      (id ? getSubById(deps.store, deps.globalName, id) : null);

    const p = coercePayload(deps.editorValue);

    const rows = deps.orRangesRows;
    const orRanges = rowsToOrRanges(rows);
    const orRangesPlan = rowsToOrRangesPlan(rows);

    const payloadToSave = coercePayload({ ...(p as any), orRanges, orRangesPlan });

    const item: SubStrategyItem = {
      id,
      name: (existing as any)?.name ?? `Auto sub ${deps.subsView.length + 1}`,
      payload: payloadToSave,
      or_ranges: rows as any,
    } as any;

    await dbSaveSub({ ...(item as any), globalName: deps.globalName });

    deps.setSubsView((prev) => upsertInArray(prev, item));
    deps.setStore((prev) => upsertSub(ensureGlobal(prev ?? emptyStore(), deps.globalName), deps.globalName, item));

    deps.dirtyRef.current = false;

    if (mode === "manual") {
      deps.lastManualSaveAtRef.current = Date.now();
      deps.setError("Guardado en sqlite");
    }
  } catch (e: any) {
    const msg = e?.message ? String(e.message) : String(e);
    deps.setError(`DB Save ERROR: ${msg}`);
  } finally {
    if (mode === "manual") deps.setIsLoading(false);
  }
}
