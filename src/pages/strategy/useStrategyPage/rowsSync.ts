/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\pages\strategy\useStrategyPage\rowsSync.ts
 *
 * Rows <-> payload synchronization
 * - rows are stable inputs (UI)
 * - editorValue is source of truth for persistence
 */
import { useEffect, useMemo } from "react";
import type { OrRangeRow, SubStrategyPayload } from "../../../strategy/types";
import { buildRows, isSameRows, rowsToOrRanges, rowsToOrRangesPlan } from "../orRangesAdapter";
import { coercePayload } from "./payload";

export function useRowsSync(args: {
  editorValue: SubStrategyPayload;
  setEditorValue: (updater: any) => void;
  orRangesRows: OrRangeRow[];
  setOrRangesRows: (rows: OrRangeRow[]) => void;
}) {
  const { editorValue, setEditorValue, orRangesRows, setOrRangesRows } = args;

  // keep rows in sync if editorValue changes via import/reload/selection
  useEffect(() => {
    const desired = buildRows((editorValue as any).orRanges, (editorValue as any).orRangesPlan);
    if (!isSameRows(orRangesRows, desired)) {
      setOrRangesRows(desired);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorValue]);

  const setOrRangesRowsAndSync = useMemo(() => {
    return (rows: OrRangeRow[]) => {
      setOrRangesRows(rows);

      const nextOrRanges = rowsToOrRanges(rows);
      const nextPlan = rowsToOrRangesPlan(rows);

      setEditorValue((prev: any) =>
        coercePayload({ ...(prev ?? {}), orRanges: nextOrRanges, orRangesPlan: nextPlan })
      );
    };
  }, [setEditorValue, setOrRangesRows]);

  return { setOrRangesRowsAndSync };
}
