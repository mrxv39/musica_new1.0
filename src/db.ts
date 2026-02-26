import Database from "@tauri-apps/plugin-sql";

export const DEFAULT_DB_PATH = "C:\\Users\\Usuario\\Desktop\\proyectos\\poker_boss\\data\\musica_new.db";

export type HandsObsRow = {
  id?: number;
  fingerprint?: string;
  table_id?: string;
  detected_at_ms?: number;
  mano_raw?: string;
  hand_class?: string;
  time_str?: string;
  preflop_ok?: number | boolean;
  noboard_ok?: number | boolean;
  ocr_json?: string;
  frame_ref?: string;
};

export async function openDb(dbPath: string) {
  return await Database.load(`sqlite:${dbPath}`);
}

export async function fetchLatestHandsObs(dbPath: string, limit = 50): Promise<HandsObsRow[]> {
  const db = await openDb(dbPath);
  const rows = await db.select<HandsObsRow[]>(
    `SELECT *
     FROM hands_obs
     ORDER BY detected_at_ms DESC
     LIMIT ?1`,
    [limit]
  );
  return rows;
}

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
  const v = obj?.ocr?.stacks?.p1 ?? obj?.stacks?.p1 ?? obj?.stacks_preflop?.stacks?.p1 ?? obj?.stacks_preflop?.p1;
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
// - nuevo: ocr_json.tempo_s
// - compat: ocr_json.tempo_ms -> se convierte a segundos
export function extractTempoS(ocrJson?: string): number | null {
  const obj = safeJson(ocrJson);
  const s = asNumber(obj?.tempo_s ?? obj?.tempoS);
  if (s !== null) return s;

  const ms = asNumber(obj?.tempo_ms ?? obj?.tempoMs ?? obj?.tempo);
  if (ms !== null) return ms / 1000;

  return null;
}
