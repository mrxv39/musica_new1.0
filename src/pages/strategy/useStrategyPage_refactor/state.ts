import { emptyStore, ensureGlobal } from "../state";
import type { StrategyStore } from "../../../strategy/types";

export function removeSubFromStore(prev: StrategyStore, globalName: string, id: string): StrategyStore {
  const next = ensureGlobal(prev ?? emptyStore(), globalName) as any;
  const arr = Array.isArray(next.globals?.[globalName]?.subs) ? next.globals[globalName].subs : [];
  next.globals[globalName].subs = arr.filter((x: any) => String(x?.id) !== String(id));
  return next as StrategyStore;
}
