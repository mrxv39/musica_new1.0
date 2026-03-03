/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\pages\strategy\useStrategyPage\autosave.ts
 *
 * Autosave debounce (sin parpadeo):
 * - respeta "cooldown" tras guardado manual
 * - un solo timer
 * - dirtyRef guarda si procede disparar
 *
 * FIX 2026-03-01:
 * - NO autosave por el hydrate que ocurre justo después de CAMBIAR selectedId
 *   (p.ej. al pulsar "New" o al seleccionar otra sub).
 * - PERO sí autosave cuando el usuario edita con el mismo selectedId.
 */
import { useEffect, useRef } from "react";
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

  const prevSelectedIdRef = useRef<string | null>(null);
  const skipNextRef = useRef<boolean>(false);

  // Detecta cambio real de selección y marca "skip" para el siguiente ciclo (hydrate).
  useEffect(() => {
    if (!selectedId) {
      prevSelectedIdRef.current = null;
      skipNextRef.current = false;
      return;
    }
    if (prevSelectedIdRef.current !== selectedId) {
      prevSelectedIdRef.current = selectedId;
      skipNextRef.current = true;

      if (autosaveTimerRef.current) {
        window.clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
    }
  }, [selectedId, autosaveTimerRef]);

  // Autosave solo por cambios reales del usuario (editor/rows) con misma selección.
  useEffect(() => {
    if (!selectedId) return;

    // Consumimos el skip del hydrate (primer cambio tras cambiar selectedId).
    if (skipNextRef.current) {
      skipNextRef.current = false;
      return;
    }

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