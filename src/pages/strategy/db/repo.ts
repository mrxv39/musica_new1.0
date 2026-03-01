/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\pages\strategy\db\repo.ts
 *
 * DB boundary (SQLite real via @tauri-apps/plugin-sql)
 * - Guarda OR ranges como 4 columnas (no JSON)  ✅
 * - Guarda OR plan (move + bet_min/max) en payload_json ✅
 * - Carga OR ranges desde columnas y OR plan desde payload_json ✅
 *
 * + Situations CRUD:
 *   - list
 *   - create (upsert)
 *   - rename
 *   - delete (warn si tiene subs; force => cascada)
 */
import type { StrategyStore, SubStrategyItem, SubStrategyPayload } from "../../../strategy/types";
import {
  initDB,
  getDB,
  listAllSubStrategies,
  listSituations,
  upsertSituationKey,
  upsertSubStrategy,
  deleteSubStrategyById,
} from "../../../db/sql";
import { ensureGlobal, emptyStore } from "../state";
import { coerceOrRangesPlan } from "../orRangesAdapter";
import { SQL } from "./queries";
import { buildPayloadFromDb, buildSubNameFromStackRange, coerceOrRanges } from "./mappers";

export type DbSaveSubResult = {
  situationKey: string;
  bucket: string; // compat: nombre/clave de la subestrategia
};

export type DbSituation = {
  id: number;
  key: string;
  created_at: string;
  updated_at: string;
};

// Inicialización real DB
export async function dbInit(): Promise<void> {
  await initDB();
}

// ------------------------------
// Situations (CRUD)
// ------------------------------

export async function dbLoadSituations(): Promise<DbSituation[]> {
  await initDB();
  return (await listSituations()) as any;
}

// Compat alias
export async function dbListSituations(): Promise<DbSituation[]> {
  return await dbLoadSituations();
}

export async function dbUpsertSituation(key: string): Promise<number> {
  await initDB();
  const k = String(key ?? "").trim();
  if (!k) throw new Error("Situation key vacío");
  return await upsertSituationKey(k);
}

// ✅ Compat: algunos imports viejos esperan dbUpsertSituationKey
export async function dbUpsertSituationKey(key: string): Promise<number> {
  return await dbUpsertSituation(key);
}

export async function dbCountSubsForSituationKey(key: string): Promise<number> {
  await initDB();
  const db = await getDB();
  const k = String(key ?? "").trim();
  if (!k) return 0;

  const rows = await db.select<Array<{ n: number }>>(SQL.countSubsForSituationKey, [k]);
  const n = Number((rows?.[0] as any)?.n ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export async function dbRenameSituationKey(oldKey: string, newKey: string): Promise<void> {
  await initDB();
  const db = await getDB();

  const from = String(oldKey ?? "").trim();
  const to = String(newKey ?? "").trim();
  if (!from) throw new Error("oldKey vacío");
  if (!to) throw new Error("newKey vacío");
  if (from === to) return;

  // existe origen?
  const src = await db.select<Array<{ id: number }>>(SQL.selectSituationIdByKey, [from]);
  if (!src || src.length === 0) throw new Error(`No existe situation: ${from}`);

  // destino ya existe?
  const dst = await db.select<Array<{ id: number }>>(SQL.selectSituationIdByKey, [to]);
  if (dst && dst.length > 0) throw new Error(`Ya existe situation con key: ${to}`);

  await db.execute(SQL.updateSituationKey, [to, from]);
}

type DeleteOpts = { force?: boolean };

// ✅ Compat: acepta boolean (viejo) o {force}
export async function dbDeleteSituationKey(
  key: string,
  opts?: DeleteOpts | boolean
): Promise<{ deleted: boolean; subCount: number }> {
  await initDB();
  const db = await getDB();

  const k = String(key ?? "").trim();
  if (!k) throw new Error("key vacío");

  const force = typeof opts === "boolean" ? opts : (opts?.force ?? false);
  const subCount = await dbCountSubsForSituationKey(k);

  if (subCount > 0 && !force) {
    // el UI/hook debe pedir confirmación
    throw new Error(`SITUATION_HAS_SUBS:${subCount}`);
  }

  // Si force=true y hay subs, con FK ON DELETE CASCADE se borran también.
  const res: any = await db.execute(SQL.deleteSituationByKey, [k]);
  const rowsAffected = Number((res as any)?.rowsAffected ?? 0);
  return { deleted: rowsAffected > 0, subCount };
}

// ------------------------------
// Subs load/save/delete
// ------------------------------

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

// Guardar 1 subestrategia en DB (1 sub dentro de 1 situación)
export async function dbSaveSub(item: SubStrategyItem & { globalName?: string }): Promise<DbSaveSubResult> {
  await initDB();

  const payload = (item as any)?.payload;

  // ✅ HARD GUARD: no permitir payload vacío/undefined
  if (!payload || typeof payload !== "object" || Object.keys(payload).length === 0) {
    throw new Error("Empty payload");
  }

  // ✅ compat: a veces viene "situation" en vez de "situacion"
  const situationKey = String((payload as any)?.situacion ?? (payload as any)?.situation ?? "").trim();
  if (!situationKey) throw new Error("Missing situation key");

  // OR ranges viene del hook/panel (puede ser rows[] o obj)
  const orRanges = coerceOrRanges((item as any)?.or_ranges ?? (payload as any)?.orRanges);

  // OR plan: viene del payload (fuente de verdad)
  const orRangesPlan = coerceOrRangesPlan((payload as any)?.orRangesPlan);

  // payload_json: guardamos también plan + orRanges por debug/compat
  const payloadForJson: SubStrategyPayload = { ...(payload as any), situacion: situationKey, orRanges, orRangesPlan };

  // ✅ name basado en rango real (NO buckets fijos)
  const stackMin = Number((payload as any)?.p1_stack_min ?? 0);
  const stackMax = Number((payload as any)?.p1_stack_max ?? 0);
  const bucket = buildSubNameFromStackRange(stackMin, stackMax);

  const situationId = await upsertSituationKey(situationKey);

  await upsertSubStrategy(situationId, bucket, payloadForJson, stackMin, stackMax, orRanges);

  return { situationKey, bucket };
}

/**
 * Borrar subestrategia por id UI "db_{id}".
 */
export async function dbDeleteSub(uiId: string): Promise<void> {
  await initDB();

  const m = String(uiId || "").match(/^db_(\d+)$/);
  if (!m) throw new Error(`Invalid sub id: ${uiId}`);

  const ok = await deleteSubStrategyById(Number(m[1]));
  if (!ok) throw new Error(`Not found: ${uiId}`);
}




