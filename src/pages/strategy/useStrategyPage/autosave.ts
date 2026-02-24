/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\pages\strategy\useStrategyPage\autosave.ts
 *
 * Autosave debounce (sin parpadeo):
 * - respeta "cooldown" tras guardado manual
 * - un solo timer
 * - dirtyRef guarda si procede disparar
 */
import { useEffect } from "react";
import type { OrRangeRow, SubStrategyPayload } from "../../../strategy/types";

export function useAutosaveDebounce(args: {
  selectedId: string | null;
  editorValue: SubStrategyPayload;
  orRangesRows: OrRangeRow[];

  lastManualSaveAtRef: { current: number };
  autosaveTimerRef: { current: number | null };
  dirtyRef: { current: boolean };

  saveAuto: () => void;

  cooldownMs?: number;
  debounceMs?: number;
}) {
  const {
    selectedId,
    editorValue,
    orRangesRows,
    lastManualSaveAtRef,
    autosaveTimerRef,
    dirtyRef,
    saveAuto,
    cooldownMs = 500,
    debounceMs = 650,
  } = args;

  useEffect(() => {
    if (!selectedId) return;

    const now = Date.now();
    if (now - lastManualSaveAtRef.current < cooldownMs) return;

    dirtyRef.current = true;

    if (autosaveTimerRef.current) {
      window.clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }

    autosaveTimerRef.current = window.setTimeout(() => {
      if (!dirtyRef.current) return;
      saveAuto();
    }, debounceMs);

    return () => {
      if (autosaveTimerRef.current) {
        window.clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorValue, orRangesRows, selectedId]);
}
