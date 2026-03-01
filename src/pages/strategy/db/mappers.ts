/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\pages\strategy\db\mappers.ts
 *
 * Pure helpers/mappers (no DB calls).
 */
import type { SubStrategyPayload } from "../../../strategy/types";
import { emptyOrRangesPlan, coerceOrRangesPlan } from "../orRangesAdapter";

export function emptyOrRanges() {
  return {
    OR_TO_CALL_ANY: "",
    OPEN_PUSH: "",
    OR_TO_CALL_SMALL: "",
    OR_TO_FOLD: "",
  };
}

/**
 * Acepta:
 * - objeto { OR_TO_CALL_ANY: "..." ... }
 * - o array de rows [{id, range, ...}]
 */
export function coerceOrRanges(input: any) {
  const base = emptyOrRanges();

  // rows array -> object
  if (Array.isArray(input)) {
    const obj: any = { ...base };
    for (const r of input) {
      const id = String(r?.id ?? "");
      if (Object.prototype.hasOwnProperty.call(obj, id)) {
        obj[id] = typeof r?.range === "string" ? r.range : String(r?.range ?? "");
      }
    }
    return obj;
  }

  const obj = input && typeof input === "object" ? input : {};
  return {
    OR_TO_CALL_ANY: typeof obj.OR_TO_CALL_ANY === "string" ? obj.OR_TO_CALL_ANY : base.OR_TO_CALL_ANY,
    OPEN_PUSH: typeof obj.OPEN_PUSH === "string" ? obj.OPEN_PUSH : base.OPEN_PUSH,
    OR_TO_CALL_SMALL: typeof obj.OR_TO_CALL_SMALL === "string" ? obj.OR_TO_CALL_SMALL : base.OR_TO_CALL_SMALL,
    OR_TO_FOLD: typeof obj.OR_TO_FOLD === "string" ? obj.OR_TO_FOLD : base.OR_TO_FOLD,
  };
}

export function safeParseJson(text: string): any {
  try {
    return JSON.parse(text || "{}");
  } catch {
    return {};
  }
}

export function buildPayloadFromDb(payloadJson: string, situationKey: string, orCols: any): SubStrategyPayload {
  const raw = safeParseJson(payloadJson);

  // OR ranges: columnas son fuente de verdad
  const orRanges = coerceOrRanges({
    OR_TO_CALL_ANY: String(orCols?.or_to_call_any ?? ""),
    OPEN_PUSH: String(orCols?.open_push ?? ""),
    OR_TO_CALL_SMALL: String(orCols?.or_to_call_small ?? ""),
    OR_TO_FOLD: String(orCols?.or_to_fold ?? ""),
  });

  // OR plan: del JSON (si no existe, default)
  const orRangesPlan = coerceOrRangesPlan(raw?.orRangesPlan ?? emptyOrRangesPlan());

  return {
    ...(raw as any),
    situacion: typeof raw?.situacion === "string" && raw.situacion.length ? raw.situacion : situationKey,
    orRanges,
    orRangesPlan,
  } as SubStrategyPayload;
}

export function fmtRangeNum(n: number): string {
  const x = Number(n);
  if (!Number.isFinite(x)) return "0";
  const r = Math.round(x * 100) / 100;
  return String(r);
}

export function buildSubNameFromStackRange(stackMin: number, stackMax: number): string {
  return fmtRangeNum(stackMin) + "_" + fmtRangeNum(stackMax);
}
