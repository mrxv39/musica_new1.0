/// C:\Users\Usuario\Desktop\proyectos\poker_boss\src\db.ts
import Database from "@tauri-apps/plugin-sql";
import { getHandsDefaultDbPath } from "./config";

export const DEFAULT_DB_PATH = getHandsDefaultDbPath();

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
  captured_gamecode?: string | null;
  linked_gamecode?: string | null;
  frame_ref?: string;
  review_status?: string | null;

  // allow dynamic columns
  [k: string]: any;
};

/** =========================
 * REAL / XML import
 * ========================= */
export type HandRealRow = {
  id: number;
  tournament_id?: number | null;
  room: string;
  hero: string;
  tournament_path: string;
  tournament_name?: string | null;
  tournament_code?: string | null;
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
  spot_png?: string | null;
  spot_json?: string | null;

  linked_obs_id?: number | null;
  ocr_match_score?: number | null;
  ocr_match_method?: string | null;
  ocr_mano_raw?: string | null;
  ocr_frame_ref?: string | null;
  linked_ocr_json?: string | null;

  wc_status?: string | null;
  wc_reason?: string | null;
  ocr_errors_json?: string | null;

  stacks_ok?: number | boolean | null;
  stacks_errors_json?: string | null;

  bets_ok?: number | boolean | null;
  bets_errors_json?: string | null;

  posiciones_ok?: number | boolean | null;
  pos_errors_json?: string | null;

  dealer_ok?: number | boolean | null;
  dealer_errors_json?: string | null;

  table_state_ok?: number | boolean | null;
  table_state_errors_json?: string | null;

  ocr_cards_match?: boolean | null;
  ocr_warn_stacks?: boolean;
  ocr_warn_bets?: boolean;
  ocr_warn_pos?: boolean;
  ocr_warn_dealer?: boolean;
  ocr_warn_table?: boolean;
  ocr_audit_status?: "no_ocr" | "ok" | "warn" | "diff";
  ocr_audit_summary?: string;
  spot_frames?: HandRealSpotFrame[];
};

export type HandRealSpotFrame = {
  hand_id: number;
  gamecode: string;
  spot_id: number;
  spot_index: number;
  street: string;
  obs_id: number;
  image_path: string;
  mano_raw?: string | null;
  hand_class?: string | null;
  match_score?: number | null;
  match_method?: string | null;
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

/** Tournaments table (XML import). */
export type TournamentRow = {
  id: number;
  room: string;
  hero: string;
  tournament_path: string;
  source_file: string;
  tournamentcode: string;
  tournamentname: string;
  startdate: string;
  created_at: string;
  [k: string]: unknown;
};

/** spots: rellenada por el worker (mesa, image_path, stacks, bets, names, tipo p2/p3, time, etc.). */
export type SpotRow = {
  id: number;
  mesa: number;
  image_path: string;
  ts: string;
  stacks_json: string;
  bets_json: string;
  names_json: string;
  tipo_p2: string;
  tipo_p3: string;
  time?: number | null;
  strategy_id?: number | null;
  strategy_move?: string | null;
  strategy_bet_min?: number | string | null;
  strategy_bet_max?: number | string | null;
  created_at: string;
  raw_json?: string;
  [k: string]: unknown;
};

/** Resumen de tiempos del worker por mesa (worker_profile). */
export type WorkerProfileRow = {
  mesa: number;
  n: number;
  ocr_avg: number | null;
  preflop_avg: number | null;
  time_gate_avg: number | null;
  total_avg: number | null;
  ocr_bets: number | null;
  ocr_stacks: number | null;
  ocr_names: number | null;
  ocr_dealer: number | null;
  ocr_gamecode: number | null;
};

type SqlDb = {
  execute: (sql: string, bindValues?: any[]) => Promise<any>;
  select: <T = any>(sql: string, bindValues?: any[]) => Promise<T>;
};

let _db: SqlDb | null = null;
let _dbPath: string | null = null;
let _dbInitPromise: Promise<void> | null = null;

export async function openDb(dbPath: string) {
  return await Database.load(`sqlite:${dbPath}`);
}

/**
 * ✅ Contract export (compat):
 * src/db.ts debe exportar dbInit/dbQuery/dbExec
 *
 * NOTE: If called from worker context that also changes DB path,
 * ensure coordination to avoid path mismatch between TS and Python.
 */
export async function dbInit(dbPath: string = DEFAULT_DB_PATH): Promise<void> {
  // Prevent concurrent reinit attempts
  if (_dbInitPromise) {
    await _dbInitPromise;
  }

  // Return early if already initialized to this path
  if (_db && _dbPath === dbPath) {
    return;
  }

  // Create new init promise
  _dbInitPromise = (async () => {
    try {
      _dbPath = dbPath;
      _db = (await openDb(dbPath)) as any;
    } finally {
      _dbInitPromise = null;
    }
  })();

  await _dbInitPromise;
}

export async function dbQuery<T = any>(sql: string, params: any[] = [], dbPath?: string): Promise<T> {
  const targetPath = dbPath ?? DEFAULT_DB_PATH;

  // Path mismatch or no db: reinitialize
  if (!_db || (targetPath !== _dbPath)) {
    await dbInit(targetPath);
  }

  // Safety check: verify path is still correct after init
  if (_dbPath !== targetPath) {
    throw new Error(`DB path mismatch after init: expected ${targetPath}, got ${_dbPath}`);
  }

  const rows = await (_db as any).select(sql, params);
  return rows as T;
}

export async function dbExec(sql: string, params: any[] = [], dbPath?: string): Promise<any> {
  const targetPath = dbPath ?? DEFAULT_DB_PATH;

  // Path mismatch or no db: reinitialize
  if (!_db || (targetPath !== _dbPath)) {
    await dbInit(targetPath);
  }

  // Safety check: verify path is still correct after init
  if (_dbPath !== targetPath) {
    throw new Error(`DB path mismatch after init: expected ${targetPath}, got ${_dbPath}`);
  }

  return await (_db as any).execute(sql, params);
}

/** ========== OBS helpers ========== */
export async function updateObsReviewStatus(
  dbPath: string,
  obsId: number,
  status: string | null
): Promise<void> {
  const db = await openDb(dbPath);
  await (db as any).execute(
    "UPDATE spots SET review_status = ?1 WHERE obs_id = ?2",
    [status, obsId]
  );
}

export async function fetchLatestHandsObs(
  dbPath: string,
  limit = 500,
  reviewFilter?: "pending" | "ok" | "error" | null
): Promise<HandsObsRow[]> {
  const db = await openDb(dbPath);
  let where = "";
  if (reviewFilter === "pending") where = "WHERE ho.review_status IS NULL";
  else if (reviewFilter === "ok") where = "WHERE ho.review_status = 'ok'";
  else if (reviewFilter === "error") where = "WHERE ho.review_status = 'error'";

  const rows = await (db as any).select(
    `SELECT
       ho.*,
       h.gamecode AS linked_gamecode
     FROM spots ho
     LEFT JOIN hands h
       ON h.id = ho.hand_id
     ${where}
     ORDER BY detected_at_ms DESC
     LIMIT ?1`,
    [limit]
  );
  return rows as HandsObsRow[];
}

/** ========== REAL helpers ========== */
function safeJsonParse(s?: string | null): any | null {
  if (!s || !String(s).trim()) return null;
  try {
    return JSON.parse(String(s));
  } catch {
    return null;
  }
}

function hasErrorsJson(s?: string | null): boolean {
  const obj = safeJsonParse(s);
  return Array.isArray(obj) && obj.length > 0;
}

function isTruthyFlag(v: unknown): boolean {
  return v === true || v === 1 || v === "1";
}

function normalizeOcrCards(manoRaw?: string | null): string {
  const s = String(manoRaw || "").trim();
  if (!s) return "";

  const matches = s.match(/(10|[2-9TJQKA])[cdhs]/gi) || [];
  if (matches.length === 0) return "";

  return matches
    .map((x) => x.toUpperCase().replace(/^10/, "T"))
    .sort()
    .join("");
}

function normalizeRealHeroCards(heroCards?: string | null): string {
  const parts = String(heroCards || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) return "";

  const cards = parts
    .map((tok) => {
      const t = tok.trim().toUpperCase();
      if (t.length < 2) return "";
      const suit = t.slice(0, 1);
      const rank = t.slice(1) === "10" ? "T" : t.slice(1);
      if (!/[CDHS]/.test(suit) || !/^(T|[2-9JQKA])$/.test(rank)) return "";
      return `${rank}${suit.toLowerCase()}`;
    })
    .filter(Boolean)
    .sort();

  return cards.join("").toUpperCase();
}

function buildHandRealAudit(row: HandRealRow): HandRealRow {
  const linked = row.linked_obs_id != null;
  if (!linked) {
    return {
      ...row,
      ocr_cards_match: null,
      ocr_warn_stacks: false,
      ocr_warn_bets: false,
      ocr_warn_pos: false,
      ocr_warn_dealer: false,
      ocr_warn_table: false,
      ocr_audit_status: "no_ocr",
      ocr_audit_summary: "NO OCR",
    };
  }

  const realCards = normalizeRealHeroCards(row.hero_cards);
  const ocrCards = normalizeOcrCards(row.ocr_mano_raw);
  const cardsMatch = realCards !== "" && ocrCards !== "" ? realCards === ocrCards : null;

  const warnStacks = !isTruthyFlag(row.stacks_ok) || hasErrorsJson(row.stacks_errors_json);
  const warnBets = !isTruthyFlag(row.bets_ok) || hasErrorsJson(row.bets_errors_json);
  const warnPos = !isTruthyFlag(row.posiciones_ok) || hasErrorsJson(row.pos_errors_json);
  const warnDealer = !isTruthyFlag(row.dealer_ok) || hasErrorsJson(row.dealer_errors_json);
  const warnTable = !isTruthyFlag(row.table_state_ok) || hasErrorsJson(row.table_state_errors_json);

  const parts: string[] = [];
  if (cardsMatch === true) parts.push("CARDS OK");
  else if (cardsMatch === false) parts.push("CARDS DIFF");
  else parts.push("CARDS ?");

  const warns: string[] = [];
  if (warnStacks) warns.push("stacks");
  if (warnBets) warns.push("bets");
  if (warnPos) warns.push("pos");
  if (warnDealer) warns.push("dealer");
  if (warnTable) warns.push("table");

  if (warns.length > 0) {
    parts.push(`WARN ${warns.join(",")}`);
  }

  const status: HandRealRow["ocr_audit_status"] =
    cardsMatch === false ? "diff" : warns.length > 0 ? "warn" : "ok";

  return {
    ...row,
    ocr_cards_match: cardsMatch,
    ocr_warn_stacks: warnStacks,
    ocr_warn_bets: warnBets,
    ocr_warn_pos: warnPos,
    ocr_warn_dealer: warnDealer,
    ocr_warn_table: warnTable,
    ocr_audit_status: status,
    ocr_audit_summary: parts.join(" | "),
  };
}

async function fetchSpotFramesMap(db: SqlDb, handIds: number[]): Promise<Map<number, HandRealSpotFrame[]>> {
  const out = new Map<number, HandRealSpotFrame[]>();
  if (handIds.length === 0) return out;

  const placeholders = handIds.map((_, idx) => `?${idx + 1}`).join(", ");
  const rows = await db.select<any[]>(
    `SELECT
       sx.hand_id AS hand_id,
       sx.gamecode AS gamecode,
       sx.spot_id AS spot_id,
       sx.spot_index AS spot_index,
       sx.street AS street,
       sl.obs_id AS obs_id,
       h.frame_ref AS image_path,
       h.mano_raw AS mano_raw,
       h.hand_class AS hand_class,
       sl.match_score AS match_score,
       sl.match_method AS match_method
     FROM spot_links sl
     JOIN spots_xml_real sx
       ON sx.spot_id = sl.spot_id
     JOIN spots h
       ON h.obs_id = sl.obs_id
     WHERE sx.hand_id IN (${placeholders})
       AND NULLIF(h.frame_ref, '') IS NOT NULL
     ORDER BY sx.hand_id ASC, sx.spot_index ASC, sl.obs_id ASC`,
    handIds
  );

  for (const row of rows) {
    const handId = Number(row.hand_id ?? 0);
    if (!handId) continue;
    if (!out.has(handId)) out.set(handId, []);
    out.get(handId)!.push({
      hand_id: handId,
      gamecode: String(row.gamecode || ""),
      spot_id: Number(row.spot_id ?? 0),
      spot_index: Number(row.spot_index ?? 0),
      street: String(row.street || ""),
      obs_id: Number(row.obs_id ?? 0),
      image_path: String(row.image_path || ""),
      mano_raw: row.mano_raw ?? null,
      hand_class: row.hand_class ?? null,
      match_score: row.match_score ?? null,
      match_method: row.match_method ?? null,
    });
  }

  return out;
}

export async function fetchLatestHandsReal(dbPath: string, limit = 200): Promise<HandRealRow[]> {
  const db = await openDb(dbPath);
  const rows = await (db as any).select(
    `SELECT
       hr.*,
       t.tournamentname AS tournament_name,
       t.tournamentcode AS tournament_code,
       s.obs_id AS linked_obs_id,
       s.mano_raw AS ocr_mano_raw,
       s.frame_ref AS ocr_frame_ref,
       s.ocr_json AS linked_ocr_json
     FROM hands hr
     LEFT JOIN tournaments t
       ON t.id = hr.tournament_id
     LEFT JOIN spots s
       ON s.hand_id = hr.id
     ORDER BY hr.startdate DESC, hr.id DESC
     LIMIT ?1`,
    [limit]
  );

  const baseRows = rows as HandRealRow[];
  const spotFramesMap = await fetchSpotFramesMap(db as any, baseRows.map((row) => row.id));

  return baseRows.map((row) =>
    buildHandRealAudit({
      ...row,
      spot_frames: spotFramesMap.get(row.id) || [],
    })
  );
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

/** List tournaments for the Hands section (same DB). */
export async function fetchTournaments(dbPath: string, limit = 200): Promise<TournamentRow[]> {
  const db = await openDb(dbPath);
  const rows = await (db as any).select(
    `SELECT id, room, hero, tournament_path, source_file, tournamentcode, tournamentname, startdate, created_at
     FROM tournaments
     ORDER BY created_at DESC
     LIMIT ?1`,
    [limit]
  );
  return rows as TournamentRow[];
}

/** List spots for the Hands section (same DB; table filled by worker). */
export async function fetchSpots(dbPath: string, limit = 500): Promise<SpotRow[]> {
  const db = await openDb(dbPath);
  const rows = await (db as any).select(
    `SELECT
       obs_id AS id,
       table_id AS mesa,
       frame_ref AS image_path,
       '' AS ts,
       json_extract(ocr_json, '$.stacks_preflop') AS stacks_json,
       json_extract(ocr_json, '$.ocr.bets') AS bets_json,
       json_extract(ocr_json, '$.ocr.villano') AS names_json,
       json_extract(ocr_json, '$.ocr.villano.p2.tipo') AS tipo_p2,
       json_extract(ocr_json, '$.ocr.villano.p3.tipo') AS tipo_p3,
       json_extract(ocr_json, '$.tempo_s') AS time,
       json_extract(ocr_json, '$.strategy.spot_strategy_id') AS strategy_id,
       json_extract(ocr_json, '$.strategy.move') AS strategy_move,
       json_extract(ocr_json, '$.strategy.betmin') AS strategy_bet_min,
       json_extract(ocr_json, '$.strategy.betmax') AS strategy_bet_max,
       created_at_ms AS created_at,
       ocr_json AS raw_json
     FROM spots
     ORDER BY detected_at_ms DESC
     LIMIT ?1`,
    [limit]
  );
  return rows as SpotRow[];
}

/** Perfilado: resumen de tiempos por mesa desde worker_profile. */
export async function fetchWorkerProfileSummary(
  dbPath: string,
  limitMesas = 50
): Promise<WorkerProfileRow[]> {
  const db = await openDb(dbPath);
  const rows = await (db as any).select(
    `SELECT
       mesa,
       COUNT(*)                    AS n,
       AVG(ocr)                    AS ocr_avg,
       AVG(preflop)                AS preflop_avg,
       AVG(time_gate)              AS time_gate_avg,
       AVG(total)                  AS total_avg,
       AVG(ocr_bets)               AS ocr_bets,
       AVG(ocr_stacks)             AS ocr_stacks,
       AVG(ocr_names)              AS ocr_names,
       AVG(ocr_dealer)             AS ocr_dealer,
       AVG(ocr_gamecode)           AS ocr_gamecode
     FROM worker_profile
     GROUP BY mesa
     ORDER BY mesa
     LIMIT ?1`,
    [limitMesas]
  );
  return rows as WorkerProfileRow[];
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
