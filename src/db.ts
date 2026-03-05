/// C:\Users\Usuario\Desktop\proyectos\poker_boss\src\db.ts
import Database from "@tauri-apps/plugin-sql";

export const DEFAULT_DB_PATH = "C:\\Users\\Usuario\\Desktop\\proyectos\\poker_boss\\data\\poker_boss.db";

/** =========================
 * OCR / OBS
 * ========================= */
export type HandsObsRow = {
  id?: number;
  obs_id?: number;
  fingerprint?: string;
  table_id?: string;
  detected_at_ms?: number;
  mano_raw?: string;
  hand_class?: string;
  time_str?: string;
  preflop_ok?: number | boolean;
  noboard_ok?: number | boolean;
  ocr_json?: string;
  p2bet?: number | null;
  p3bet?: number | null;
  frame_ref?: string;

  // allow dynamic columns
  [k: string]: any;
};

/** =========================
 * REAL / XML import
 * ========================= */
export type HandRealRow = {
  id: number;
  room: string;
  hero: string;
  tournament_path: string;
  source_file: string;
  gamecode: string;
  startdate: string;
  sb: number;
  bb: number;
  hero_cards: string;
  flop: string;
  turn: string;
  river: string;
  players_json: string;
  created_at: string;
};

export type ActionRealRow = {
  id: number;
  hand_id: number;
  gamecode: string;
  round_no: number; // 1..4
  action_no: number;
  player: string;
  type_id: number;
  type_name: string;
  sum_chips: number;
  sum_bb: number;
  created_at: string;
};

type SqlDb = {
  execute: (sql: string, bindValues?: any[]) => Promise<any>;
  select: <T = any>(sql: string, bindValues?: any[]) => Promise<T>;
};

let _db: SqlDb | null = null;
let _dbPath: string | null = null;

export async function openDb(dbPath: string) {
  return await Database.load(`sqlite:${dbPath}`);
}

/**
 * ✅ Contract export (compat):
 * src/db.ts debe exportar dbInit/dbQuery/dbExec
 */
export async function dbInit(dbPath: string = DEFAULT_DB_PATH): Promise<void> {
  _dbPath = dbPath;
  _db = (await openDb(dbPath)) as any;
}

export async function dbQuery<T = any>(sql: string, params: any[] = [], dbPath?: string): Promise<T> {
  if (!_db || (dbPath && dbPath !== _dbPath)) {
    await dbInit(dbPath ?? DEFAULT_DB_PATH);
  }
  const rows = await (_db as any).select(sql, params);
  return rows as T;
}

export async function dbExec(sql: string, params: any[] = [], dbPath?: string): Promise<any> {
  if (!_db || (dbPath && dbPath !== _dbPath)) {
    await dbInit(dbPath ?? DEFAULT_DB_PATH);
  }
  return await (_db as any).execute(sql, params);
}

/** ========== OBS helpers ========== */
export async function fetchLatestHandsObs(dbPath: string, limit = 50): Promise<HandsObsRow[]> {
  const db = await openDb(dbPath);
  const rows = await (db as any).select(
    `SELECT *
     FROM hands_obs
     ORDER BY detected_at_ms DESC
     LIMIT ?1`,
    [limit]
  );
  return rows as HandsObsRow[];
}

/** ========== REAL helpers ========== */
export async function fetchLatestHandsReal(dbPath: string, limit = 200): Promise<HandRealRow[]> {
  const db = await openDb(dbPath);
  const rows = await (db as any).select(
    `SELECT *
     FROM hands_real
     ORDER BY startdate DESC, id DESC
     LIMIT ?1`,
    [limit]
  );
  return rows as HandRealRow[];
}

export async function fetchActionsRealForHand(dbPath: string, handId: number): Promise<ActionRealRow[]> {
  const db = await openDb(dbPath);
  const rows = await (db as any).select(
    `SELECT *
     FROM actions_real
     WHERE hand_id = ?1
     ORDER BY round_no ASC, action_no ASC`,
    [handId]
  );
  return rows as ActionRealRow[];
}

/** ========== Existing extractors used by UI ========== */
function safeJson(ocrJson?: string): any | null {
  if (!ocrJson) return null;
  try {
    return JSON.parse(ocrJson);
  } catch {
    return null;
  }
}

function asNumber(v: any): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function extractP1Stack(ocrJson?: string): number | null {
  const obj = safeJson(ocrJson);
  const v =
    obj?.ocr?.stacks?.p1 ??
    obj?.stacks?.p1 ??
    obj?.stacks_preflop?.stacks?.p1 ??
    obj?.stacks_preflop?.p1;
  return asNumber(v);
}

export function extractP1Bet(ocrJson?: string): number | null {
  const obj = safeJson(ocrJson);
  const v = obj?.ocr?.bets?.p1 ?? obj?.bets?.p1;
  return asNumber(v);
}

export function extractMove(ocrJson?: string): string {
  const obj = safeJson(ocrJson);
  const v = obj?.strategy?.move;
  return typeof v === "string" ? v : "";
}

export function extractBetMin(ocrJson?: string): number | null {
  const obj = safeJson(ocrJson);
  const v = obj?.strategy?.bet_min_bb ?? obj?.strategy?.betmin ?? obj?.strategy?.bet_min;
  return asNumber(v);
}

export function extractBetMax(ocrJson?: string): number | null {
  const obj = safeJson(ocrJson);
  const v = obj?.strategy?.bet_max_bb ?? obj?.strategy?.betmax ?? obj?.strategy?.bet_max;
  return asNumber(v);
}

export function extractSituacion(ocrJson?: string): string {
  const obj = safeJson(ocrJson);
  const v = obj?.strategy?.situacion ?? obj?.strategy?.situation ?? obj?.strategy?.spot;
  return typeof v === "string" ? v : "";
}

// ✅ stackefectivo (ocr_json.ocr.stackefectivo.value)
export function extractStackEfectivo(ocrJson?: string): number | null {
  const obj = safeJson(ocrJson);
  const v =
    obj?.ocr?.stackefectivo?.value ??
    obj?.ocr?.stackefectivo ??
    obj?.stackefectivo?.value ??
    obj?.stackefectivo;
  return asNumber(v);
}

// ✅ tempo en SEGUNDOS
export function extractTempoS(ocrJson?: string): number | null {
  const obj = safeJson(ocrJson);
  const s = asNumber(obj?.tempo_s ?? obj?.tempoS);
  if (s !== null) return s;

  const ms = asNumber(obj?.tempo_ms ?? obj?.tempoMs ?? obj?.tempo);
  if (ms !== null) return ms / 1000;

  return null;
}
