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

export function extractP1Stack(ocrJson?: string): number | null {
  if (!ocrJson) return null;
  try {
    const obj = JSON.parse(ocrJson);
    const p1 = obj?.stacks?.p1;
    if (typeof p1 === "number") return p1;
    if (typeof p1 === "string") {
      const n = Number(p1);
      return Number.isFinite(n) ? n : null;
    }
    return null;
  } catch {
    return null;
  }
}
