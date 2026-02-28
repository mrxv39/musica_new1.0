/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\pages\strategy\db.ts
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
import type { StrategyStore, SubStrategyItem, SubStrategyPayload } from "../../strategy/types";
import {
  initDB,
  getDB,
  listAllSubStrategies,
  listSituations,
  upsertSituationKey,
  upsertSubStrategy,
  deleteSubStrategyById,
} from "../../db/sql";
import { ensureGlobal, emptyStore } from "./state";
import { emptyOrRangesPlan, coerceOrRangesPlan } from "./orRangesAdapter";

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

// ------------------------------
// Situations (CRUD)
// ------------------------------

export async function dbListSituations(): Promise<DbSituation[]> {
  await initDB();
  return (await listSituations()) as any;
}

export async function dbUpsertSituation(key: string): Promise<number> {
  await initDB();
  const k = String(key ?? "").trim();
  if (!k) throw new Error("Situation key vacío");
  return await upsertSituationKey(k);
}

export async function dbCountSubsForSituationKey(key: string): Promise<number> {
  await initDB();
  const db = await getDB();
  const k = String(key ?? "").trim();
  if (!k) return 0;

  const rows = await db.select<Array<{ n: number }>>(
    `
    SELECT COUNT(*) as n
    FROM sub_strategies ss
    JOIN situations s ON s.id = ss.situation_id
    WHERE s.key = ?1;
  `,
    [k]
  );
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
  const src = await db.select<Array<{ id: number }>>(`SELECT id FROM situations WHERE key = ?1 LIMIT 1;`, [from]);
  if (!src || src.length === 0) throw new Error(`No existe situation: ${from}`);

  // destino ya existe?
  const dst = await db.select<Array<{ id: number }>>(`SELECT id FROM situations WHERE key = ?1 LIMIT 1;`, [to]);
  if (dst && dst.length > 0) throw new Error(`Ya existe situation con key: ${to}`);

  await db.execute(`UPDATE situations SET key = ?1, updated_at = datetime('now') WHERE key = ?2;`, [to, from]);
}

export async function dbDeleteSituationKey(key: string, opts?: { force?: boolean }): Promise<{ deleted: boolean; subCount: number }> {
  await initDB();
  const db = await getDB();

  const k = String(key ?? "").trim();
  if (!k) throw new Error("key vacío");

  const subCount = await dbCountSubsForSituationKey(k);

  if (subCount > 0 && !(opts?.force ?? false)) {
    // el UI debe pedir confirmación
    throw new Error(`SITUATION_HAS_SUBS:${subCount}`);
  }

  // Si force=true y hay subs, con FK ON DELETE CASCADE se borran también.
  const res: any = await db.execute(`DELETE FROM situations WHERE key = ?1;`, [k]);
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

function fmtRangeNum(n: number): string {
  const x = Number(n);
  if (!Number.isFinite(x)) return "0";
  // evita 9.5000000001, conserva 9.5, máximo 2 decimales
  const r = Math.round(x * 100) / 100;
  return String(r);
}

function buildSubNameFromStackRange(stackMin: number, stackMax: number): string {
  return `${fmtRangeNum(stackMin)}_${fmtRangeNum(stackMax)}`;
}

// Guardar 1 subestrategia en DB (1 sub dentro de 1 situación)
export async function dbSaveSub(item: SubStrategyItem & { globalName?: string }): Promise<DbSaveSubResult> {
  await initDB();

  const payload = (item as any)?.payload ?? {};

  // ✅ compat: a veces viene "situation" en vez de "situacion"
  const situationKey = String(payload?.situacion ?? payload?.situation ?? "unknown");

  // OR ranges viene del hook/panel (puede ser rows[] o obj)
  const orRanges = coerceOrRanges((item as any)?.or_ranges ?? (payload as any)?.orRanges);

  // OR plan: viene del payload (fuente de verdad)
  const orRangesPlan = coerceOrRangesPlan((payload as any)?.orRangesPlan);

  // payload_json: guardamos también plan + orRanges por debug/compat
  const payloadForJson = { ...(payload as any), situacion: situationKey, orRanges, orRangesPlan };

  // ✅ name basado en rango real (NO buckets fijos)
  const stackMin = Number(payload?.p1_stack_min ?? 0);
  const stackMax = Number(payload?.p1_stack_max ?? 0);
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
