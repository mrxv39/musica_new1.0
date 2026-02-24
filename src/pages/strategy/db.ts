/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\pages\strategy\db.ts
 *
 * DB boundary (SQLite real via @tauri-apps/plugin-sql)
 * - Guarda OR ranges como 4 columnas (no JSON)  ✅
 * - Guarda OR plan (move + bet_min/max) en payload_json ✅
 * - Carga OR ranges desde columnas y OR plan desde payload_json ✅
 */
import type { StrategyStore, SubStrategyItem, SubStrategyPayload } from "../../strategy/types";
import {
  initDB,
  listAllSubStrategies,
  pickBucketName,
  upsertSituationKey,
  ensureBucketsForSituation,
  upsertSubStrategy,
} from "../../db/sql";
import { ensureGlobal, emptyStore } from "./state";
import { OR_KEYS, emptyOrRangesPlan, coerceOrRangesPlan } from "./orRangesAdapter";

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

/**
 * Acepta:
 * - objeto { OR_TO_CALL_ANY: "..." ... }
 * - o array de rows [{id, range, ...}]
 */
function coerceOrRanges(input: any) {
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

function safeParseJson(text: string): any {
  try {
    return JSON.parse(text || "{}");
  } catch {
    return {};
  }
}

function buildPayloadFromDb(payloadJson: string, situationKey: string, orCols: any): SubStrategyPayload {
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

// Inicialización real DB
export async function dbInit(): Promise<void> {
  await initDB();
}

// Cargar subs (para UI): cargamos TODO lo que exista en DB y lo metemos en globals[globalName]
export async function dbLoadSubs(globalName: string): Promise<StrategyStore> {
  await initDB();

  const rows = await listAllSubStrategies();
  const store = ensureGlobal(emptyStore(), globalName);

  const subs: SubStrategyItem[] = (rows ?? []).map((r) => {
    const payload = buildPayloadFromDb(r.payload_json, r.situation_key, r);

    // compat: dejamos también "or_ranges" (obj plano)
    const or_ranges = (payload as any).orRanges;

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

  // OR ranges viene del hook/panel (puede ser rows[] o obj)
  const orRanges = coerceOrRanges((item as any)?.or_ranges ?? (payload as any)?.orRanges);

  // OR plan: viene del payload (fuente de verdad)
  const orRangesPlan = coerceOrRangesPlan((payload as any)?.orRangesPlan);

  // payload_json: guardamos también plan + orRanges por debug/compat
  const payloadForJson = { ...(payload as any), orRanges, orRangesPlan };

  // bucket por stack efectivo (p1_stack_min/max)
  const stackMin = Number(payload?.p1_stack_min ?? 0);
  const stackMax = Number(payload?.p1_stack_max ?? 0);
  const bucket = pickBucketName(stackMin, stackMax);

  const situationId = await upsertSituationKey(situationKey);

  // opcional: asegura buckets fijos
  await ensureBucketsForSituation(situationId);

  await upsertSubStrategy(situationId, bucket, payloadForJson, stackMin, stackMax, orRanges);

  return { situationKey, bucket };
}
