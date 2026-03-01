/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\pages\strategy\db\repo.ts
 *
 * REBUILD desde cero: boundary estable para StrategyPage
 * - Situations CRUD (delete force soportado)
 * - Subs CRUD mínimo (persist payload_json)
 */

import type { StrategyStore, SubStrategyItem, SubStrategyPayload } from "../../../strategy/types";
import {
  initDB,
  listSituations,
  upsertSituationKey,
  renameSituationKey,
  deleteSituationByKey,
  countSubsForSituationKey,
  listAllSubStrategies,
  upsertSubStrategy,
  deleteSubStrategyById,
} from "../../../db/sql";
import { ensureGlobal, emptyStore } from "../state";

export type DbSituation = {
  id: number;
  key: string;
  created_at: string;
  updated_at: string;
};

export type DbSaveSubResult = {
  situationKey: string;
  bucket: string;
};

export async function dbInit(): Promise<void> {
  await initDB();
}

// ------------------------------
// Situations (CRUD)
// ------------------------------

export async function dbListSituations(): Promise<DbSituation[]> {
  await initDB();
  return (await listSituations()) as any;
}

export async function dbLoadSituations(): Promise<DbSituation[]> {
  return await dbListSituations();
}

export async function dbUpsertSituation(key: string): Promise<number> {
  await initDB();
  const k = String(key ?? "").trim();
  if (!k) throw new Error("Situation key vacío");
  return await upsertSituationKey(k);
}

export async function dbUpsertSituationKey(key: string): Promise<number> {
  return await dbUpsertSituation(key);
}

export async function dbCountSubsForSituationKey(key: string): Promise<number> {
  return await countSubsForSituationKey(String(key ?? "").trim());
}

export async function dbRenameSituationKey(oldKey: string, newKey: string): Promise<void> {
  return await renameSituationKey(oldKey, newKey);
}

type DeleteOpts = { force?: boolean };

export async function dbDeleteSituationKey(
  key: string,
  opts?: DeleteOpts | boolean
): Promise<{ deleted: boolean; subCount: number }> {
  await initDB();
  const k = String(key ?? "").trim();
  if (!k) throw new Error("key vacío");

  const force = typeof opts === "boolean" ? opts : (opts?.force ?? false);
  const subCount = await dbCountSubsForSituationKey(k);

  // 🔒 En este rebuild: SIEMPRE soportamos force.
  // Si force=false y hay subs -> forzamos el patrón de confirmación del UI
  if (subCount > 0 && !force) {
    throw new Error(`SITUATION_HAS_SUBS:${subCount}`);
  }

  const rowsAffected = await deleteSituationByKey(k);
  return { deleted: rowsAffected > 0, subCount };
}

// ------------------------------
// Subs load/save/delete
// ------------------------------

export async function dbLoadSubs(globalName: string): Promise<StrategyStore> {
  await initDB();

  const rows = await listAllSubStrategies();
  const store = ensureGlobal(emptyStore(), globalName);

  const subs: any[] = (rows ?? []).map((r: any) => {
    let payload: SubStrategyPayload;
    try {
      payload = JSON.parse(String(r.payload_json ?? "{}"));
    } catch {
      payload = {} as any;
    }

    // fuente de verdad: situacion = situation_key
    (payload as any).situacion = String(r.situation_key ?? "");

    return {
      id: `db_${r.id}`,
      name: `${r.situation_key} • ${r.name}`,
      payload,
      // compat: algunos componentes esperan or_ranges / orRanges
      or_ranges: (payload as any).orRanges ?? undefined,
    };
  });

  (store as any).globals[globalName].subs = subs;
  return store;
}

function buildBucketFromStackRange(min: number, max: number): string {
  const a = Number.isFinite(min) ? min : 0;
  const b = Number.isFinite(max) ? max : 0;
  return `${a}_${b}_BB`;
}

export async function dbSaveSub(item: SubStrategyItem & { globalName?: string }): Promise<DbSaveSubResult> {
  await initDB();

  const payload = (item as any)?.payload;

  if (!payload || typeof payload !== "object" || Object.keys(payload).length === 0) {
    throw new Error("Empty payload");
  }

  const situationKey = String((payload as any)?.situacion ?? (payload as any)?.situation ?? "").trim();
  if (!situationKey) throw new Error("Missing situation key");

  // Generamos el nombre de la sub por rango de stack (como ya venías haciendo)
  const stackMin = Number((payload as any)?.p1_stack_min ?? 0);
  const stackMax = Number((payload as any)?.p1_stack_max ?? 0);
  const bucket = buildBucketFromStackRange(stackMin, stackMax);

  const situationId = await upsertSituationKey(situationKey);

  // Guardamos todo el payload; que el editor/UI decida qué usa
  await upsertSubStrategy(situationId, bucket, payload, stackMin, stackMax);

  return { situationKey, bucket };
}

export async function dbDeleteSub(uiId: string): Promise<void> {
  await initDB();

  const m = String(uiId || "").match(/^db_(\d+)$/);
  if (!m) throw new Error(`Invalid sub id: ${uiId}`);

  const ok = await deleteSubStrategyById(Number(m[1]));
  if (!ok) throw new Error(`Not found: ${uiId}`);
}