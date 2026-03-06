/// C:\Users\Usuario\Desktop\proyectos\poker_boss\src\pages\hands\useVisibleColumns.ts

import React from "react";
import { safeParseJson, uniqStable } from "./handsTableUtils";

export type ColumnLike = { id: string };

export function useVisibleColumns<TCol extends ColumnLike>(columns: TCol[], storageKey: string) {
  const [visibleIds, setVisibleIds] = React.useState<string[]>(() => {
    const saved = safeParseJson<string[]>(localStorage.getItem(storageKey));
    return Array.isArray(saved) ? saved : [];
  });

  React.useEffect(() => {
    const allIds = columns.map((c) => c.id);
    const saved = safeParseJson<string[]>(localStorage.getItem(storageKey));
    const current =
      Array.isArray(saved) && saved.length > 0
        ? saved
        : visibleIds.length > 0
          ? visibleIds
          : allIds;

    const curSet = new Set(current);
    const merged = allIds.filter((id) => curSet.has(id) || !Array.isArray(saved) || saved.length === 0);
    const final = uniqStable(merged.length > 0 ? merged : allIds);

    // primera inicialización
    if (visibleIds.length === 0 && (!Array.isArray(saved) || saved.length === 0)) {
      setVisibleIds(final);
      localStorage.setItem(storageKey, JSON.stringify(final));
      return;
    }

    // reparar cuando cambian las columnas
    if (final.length !== uniqStable(current).length) {
      setVisibleIds(final);
      localStorage.setItem(storageKey, JSON.stringify(final));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columns]);

  const onChangeVisibleIds = (next: string[]) => {
    const cleaned = uniqStable(next);
    setVisibleIds(cleaned);
    localStorage.setItem(storageKey, JSON.stringify(cleaned));
  };

  const visibleColumns = React.useMemo(() => {
    if (!visibleIds || visibleIds.length === 0) return columns;
    const set = new Set(visibleIds);
    return columns.filter((c) => set.has(c.id));
  }, [columns, visibleIds]);

  return { visibleIds, visibleColumns, onChangeVisibleIds };
}
