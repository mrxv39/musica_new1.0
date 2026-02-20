/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\pages\strategy\hooks.ts
 *
 * Composición estable de Strategy:
 * - Loader solo mount/global
 * - Actions no recargan, solo upsert in-memory
 */
import { useCallback, useMemo, useState } from "react";
import type { StrategyStore, SubStrategyItem, SubStrategyPayload, OrRanges } from "../../strategy/types";
import { ensureGlobal, listSubs } from "../../strategy/store";
import { normalizePayload } from "../../strategy/utils";
import { emptyStore as emptyStoreDefaults, defaultPayload } from "./defaults";
import { useStrategyLoader } from "./useStrategyLoader";
import { useStrategyActions } from "./useStrategyActions";

const DEFAULT_OR: OrRanges = {
  OR_TO_CALL_ANY: "",
  OPEN_PUSH: "",
  OR_TO_CALL_SMALL: "",
  OR_TO_FOLD: "",
};

export function useStrategyHooks() {
  const [globalName, setGlobalName] = useState("default");
  const [store, setStore] = useState<StrategyStore>(() => emptyStoreDefaults());

  const [activeId, setActiveId] = useState("");
  const [payload, setPayload] = useState<SubStrategyPayload | null>(defaultPayload());
  const [orRanges, setOrRanges] = useState<OrRanges>({ ...DEFAULT_OR });

  const subs = useMemo(() => {
    const s = ensureGlobal(store, globalName as any);
    return listSubs(s as any, globalName as any);
  }, [store, globalName]);

  const selectItem = useCallback((it: SubStrategyItem | null) => {
    if (!it) {
      setActiveId("");
      setPayload(null);
      setOrRanges({ ...DEFAULT_OR });
      return;
    }
    const p = normalizePayload(it.payload as SubStrategyPayload);
    setPayload(p);
    setActiveId(it.id);

    const fromItem = (it as any).or_ranges;
    const fromPayload = (p as any).orRanges;
    setOrRanges({ ...DEFAULT_OR, ...(fromPayload || {}), ...(fromItem || {}) });
  }, []);

  const loader = useStrategyLoader({
    globalName,
    setStore,
    onLoadedSelectFirst: selectItem,
  });

  const actions = useStrategyActions({
    globalName,
    store,
    setStore,

    activeId,
    setActiveId,

    payload,
    setPayload,

    orRanges,
    setOrRanges,

    onSelectItem: selectItem,
  });

  const patchPayload = useCallback((patch: Partial<SubStrategyPayload>) => {
    setPayload((prev) => {
      const base = prev ?? defaultPayload();
      const next = normalizePayload({ ...(base as any), ...(patch as any) });
      return next;
    });
    // ✅ autosave "programado" aquí
    actions.scheduleAutosave();
  }, [actions]);

  const patchOrRanges = useCallback((r: OrRanges) => {
    setOrRanges({ ...DEFAULT_OR, ...(r || {}) });
    // ✅ autosave "programado" aquí
    actions.scheduleAutosave();
  }, [actions]);

  const selectById = useCallback((id: string) => {
    const it = subs.find((x) => x.id === id) || null;
    selectItem(it);
  }, [subs, selectItem]);

  return {
    globalName,
    setGlobalName,

    store,
    subs,

    activeId,
    payload,
    orRanges,

    patchPayload,
    patchOrRanges,

    selectById,
    selectItem,

    ...loader,
    ...actions,
  };
}
