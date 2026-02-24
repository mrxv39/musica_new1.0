/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\pages\strategy\useStrategyPage\selection.ts
 *
 * Hydrate editorValue + rows when selection changes
 */
import { useEffect } from "react";
import type { OrRangeRow, StrategyStore, SubStrategyItem } from "../../../strategy/types";
import { getSubById } from "../state";
import { buildRows } from "../orRangesAdapter";
import { coercePayload } from "./payload";

export function useSelectionHydration(args: {
  selectedId: string | null;
  store: StrategyStore;
  subsView: SubStrategyItem[];
  globalName: string;

  setEditorValue: (p: any) => void;
  setOrRangesRows: (rows: OrRangeRow[]) => void;

  dirtyRef: { current: boolean };
}) {
  const { selectedId, store, subsView, globalName, setEditorValue, setOrRangesRows, dirtyRef } = args;

  useEffect(() => {
    if (!selectedId) return;

    const it =
      subsView.find((x: any) => (x as any)?.id === selectedId) ?? getSubById(store, globalName, selectedId);
    if (!it) return;

    const p = coercePayload((it as any).payload);
    setEditorValue(p);

    const rows = buildRows((p as any).orRanges, (p as any).orRangesPlan);
    setOrRangesRows(rows);

    dirtyRef.current = false;
  }, [selectedId, store, globalName, subsView, setEditorValue, setOrRangesRows, dirtyRef]);
}
