/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\pages\strategy\state.ts
 *
 * Estado puro. Tipos oficiales: src/strategy/types
 * - globals[global].subs es array
 */
import type { SubStrategyPayload, StrategyStore, SubStrategyItem } from "../../strategy/types";
import { normalizePayload } from "../../strategy/utils";
import { getUiTimeKey } from "./model";

// 🔑 Para que otros módulos puedan importar el tipo desde aquí (StrategySidebar, etc.)
export type { SubStrategyItem };

export function defaultPayload(): SubStrategyPayload {
  // ✅ IMPORTANTE:
  // Debe ser un payload COMPLETO para que Guardar no pueda fallar por missing fields.
  // (la validación dura de DB exige spot/hero_pos/pos/tipos + rangos finitos + situacion)
  const base: any = {
    // posiciones core
    spot: "BTN",
    hero_pos: "BTN",
    p2_pos: "SB",
    p3_pos: "BB",

    // tipos core
    p2_tipo: "unknown",
    p3_tipo: "unknown",

    // rangos mínimos finitos (0..0 por defecto)
    p1_stack_min: 0,
    p1_stack_max: 0,
    p1_bet_min: 0,
    p1_bet_max: 0,
    p1_se_min: 0,
    p1_se_max: 0,

    p2_stack_min: 0,
    p2_stack_max: 0,
    p2_bet_min: 0,
    p2_bet_max: 0,

    p3_stack_min: 0,
    p3_stack_max: 0,
    p3_bet_min: 0,
    p3_bet_max: 0,

    // OR ranges siempre presentes
    orRanges: {
      OR_TO_CALL_ANY: "",
      OPEN_PUSH: "",
      OR_TO_CALL_SMALL: "",
      OR_TO_FOLD: "",
    },

    // Plan opcional (si tu coerce lo rellena, ok; si no, queda vacío)
    // orRangesPlan: ...
  };

  // normalizePayload suele recalcular "situacion" y limpiar defaults.
  // Si normalizePayload no la añade, el contrato seguirá fallando:
  // en ese caso, el siguiente paso será endurecer normalizePayload.
  return normalizePayload(base as SubStrategyPayload);
}

export function emptyStore(): StrategyStore {
  return { globals: {} } as StrategyStore;
}

export function ensureGlobal(store: StrategyStore | null | undefined, globalName: string): StrategyStore {
  const next = (store ?? emptyStore()) as any;
  if (!next.globals) next.globals = {};
  if (!next.globals[globalName]) next.globals[globalName] = { name: globalName, subs: [] };
  if (!Array.isArray(next.globals[globalName].subs)) next.globals[globalName].subs = [];
  return next as StrategyStore;
}

export function getSubsArray(store: StrategyStore, globalName: string): SubStrategyItem[] {
  const s = ensureGlobal(store, globalName) as any;
  const arr = (s.globals?.[globalName]?.subs ?? []) as SubStrategyItem[];
  return Array.isArray(arr) ? arr : [];
}

export function getSubById(store: StrategyStore, globalName: string, id: string): SubStrategyItem | null {
  return getSubsArray(store, globalName).find((x: any) => x?.id === id) ?? null;
}

export function listSubs(store: StrategyStore, globalName: string): SubStrategyItem[] {
  const subs = [...getSubsArray(store, globalName)];

  subs.sort((a, b) => {
    const ta = getUiTimeKey(a);
    const tb = getUiTimeKey(b);
    if (ta && tb && ta !== tb) return tb.localeCompare(ta);
    return 0;
  });

  return subs;
}

export function upsertSub(store: StrategyStore, globalName: string, item: SubStrategyItem): StrategyStore {
  const s = ensureGlobal(store, globalName) as any;
  const arr = getSubsArray(s as StrategyStore, globalName);
  const idx = arr.findIndex((x: any) => x?.id === (item as any)?.id);
  if (idx >= 0) arr[idx] = item;
  else arr.push(item);
  s.globals[globalName].subs = arr;
  return s as StrategyStore;
}