/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\pages\strategy\db.ts
 *
 * DB boundary (SQLite real via @tauri-apps/plugin-sql)
 * - Guarda OR ranges como 4 columnas (no JSON)
 * - Carga OR ranges desde columnas y lo expone como or_ranges (objeto con 4 keys)
 */
import type { StrategyStore, SubStrategyItem, SubStrategyPayload } from "../../strategy/types";
import { initDB, listAllSubStrategies, pickBucketName, upsertSituationKey, ensureBucketsForSituation, upsertSubStrategy } from "../../db/sql";
import { ensureGlobal, emptyStore } from "./state";

export type DbSaveSubResult = {
  situationKey: string;
  bucket: string;
};

function emptyOrRanges() {
  return {
    OR_TO_CALL_ANY: "",
    OPEN_PUSH: "",
    OR_TO_CALL_SMALL: "",
    OR_TO_FOLD: "",
  };
}

function coerceOrRanges(input: any) {
  const base = emptyOrRanges();
  const obj = input && typeof input === "object" ? input : {};
  return {
    OR_TO_CALL_ANY: typeof obj.OR_TO_CALL_ANY === "string" ? obj.OR_TO_CALL_ANY : base.OR_TO_CALL_ANY,
    OPEN_PUSH: typeof obj.OPEN_PUSH === "string" ? obj.OPEN_PUSH : base.OPEN_PUSH,
    OR_TO_CALL_SMALL: typeof obj.OR_TO_CALL_SMALL === "string" ? obj.OR_TO_CALL_SMALL : base.OR_TO_CALL_SMALL,
    OR_TO_FOLD: typeof obj.OR_TO_FOLD === "string" ? obj.OR_TO_FOLD : base.OR_TO_FOLD,
  };
}

function safeParseJson(text: string): any {
  try {
    return JSON.parse(text || "{}");
  } catch {
    return {};
  }
}

function buildPayloadFromDb(payloadJson: string, situationKey: string, orCols: any): SubStrategyPayload {
  const raw = safeParseJson(payloadJson);

  // Asegura situacion + orRanges desde columnas (fuente de verdad)
  const orRanges = coerceOrRanges({
    OR_TO_CALL_ANY: String(orCols?.or_to_call_any ?? ""),
    OPEN_PUSH: String(orCols?.open_push ?? ""),
    OR_TO_CALL_SMALL: String(orCols?.or_to_call_small ?? ""),
    OR_TO_FOLD: String(orCols?.or_to_fold ?? ""),
  });

  return {
    ...(raw as any),
    situacion: typeof raw?.situacion === "string" && raw.situacion.length ? raw.situacion : situationKey,
    orRanges,
  } as SubStrategyPayload;
}

// Inicialización real DB
export async function dbInit(): Promise<void> {
  await initDB();
}

// Cargar subs (para UI): aquí cargamos TODO lo que exista en DB y lo metemos en globals[globalName]
export async function dbLoadSubs(globalName: string): Promise<StrategyStore> {
  await initDB();

  const rows = await listAllSubStrategies();

  const store = ensureGlobal(emptyStore(), globalName);

  const subs: SubStrategyItem[] = (rows ?? []).map((r) => {
    const payload = buildPayloadFromDb(r.payload_json, r.situation_key, r);

    // ✅ UI usa item.or_ranges y lo coercea a OrRanges
    const or_ranges = payload.orRanges;

    return {
      id: `db_${r.id}`,
      name: `${r.situation_key} • ${r.name}`,
      payload,
      or_ranges,
    } as any;
  });

  (store as any).globals[globalName].subs = subs;
  return store;
}

// Guardar 1 subestrategia en DB (1 bucket dentro de 1 situación)
export async function dbSaveSub(item: SubStrategyItem & { globalName?: string }): Promise<DbSaveSubResult> {
  await initDB();

  const payload = (item as any)?.payload ?? {};
  const situationKey = String(payload?.situacion ?? "unknown");

  // OR ranges viene de panel (estado separado) => fuente real para persistir
  const orRanges = coerceOrRanges((item as any)?.or_ranges);

  // Mergeamos para que payload_json también lo contenga (compat/debug), pero la fuente de verdad son columnas
  const payloadForJson = { ...(payload as any), orRanges };

  // bucket por stack efectivo (p1_stack_min/max)
  const stackMin = Number(payload?.p1_stack_min ?? 0);
  const stackMax = Number(payload?.p1_stack_max ?? 0);
  const bucket = pickBucketName(stackMin, stackMax);

  const situationId = await upsertSituationKey(situationKey);

  // opcional: asegura buckets fijos (si quieres pre-crear filas)
  await ensureBucketsForSituation(situationId);

  await upsertSubStrategy(
    situationId,
    bucket,
    payloadForJson,
    stackMin,
    stackMax,
    orRanges
  );

  return { situationKey, bucket };
}
