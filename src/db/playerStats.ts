/**
 * Read-only queries for the player_stats table (populated by Python backend).
 *
 * Table schema (composite PK: player + table_size):
 *   player TEXT, table_size INTEGER, total_hands INTEGER,
 *   vpip_hands, pfr_hands, threeb_hands, threeb_opps,
 *   fold_to_3b, fold_to_3b_opps, fourb_hands, fourb_opps,
 *   limp_hands, af_bets_raises, af_calls,
 *   wtsd_hands, wtsd_opps, won_hands,
 *   total_won_chips REAL, total_bet_chips REAL, updated_at TEXT
 */

import Database from "@tauri-apps/plugin-sql";
import { getPlayersDbUrl } from "../config";

let _db: Database | null = null;

async function getDB(): Promise<Database> {
  if (_db) return _db;
  _db = await Database.load(getPlayersDbUrl());
  return _db;
}

export type PlayerStatsRow = {
  player: string;
  table_size: number;
  total_hands: number;
  vpip_hands: number;
  pfr_hands: number;
  threeb_hands: number;
  threeb_opps: number;
  fold_to_3b: number;
  fold_to_3b_opps: number;
  fourb_hands: number;
  fourb_opps: number;
  limp_hands: number;
  af_bets_raises: number;
  af_calls: number;
  wtsd_hands: number;
  wtsd_opps: number;
  won_hands: number;
  total_won_chips: number;
  total_bet_chips: number;
  updated_at: string;
};

/** Computed stats for display */
export type PlayerStatsComputed = PlayerStatsRow & {
  vpip: number;
  pfr: number;
  threeb: number;
  fold_to_3b_pct: number;
  limp_pct: number;
  af: number;
  wtsd: number;
};

function pct(num: number, den: number): number {
  return den > 0 ? Math.round((num / den) * 1000) / 10 : 0;
}

export function computeStats(row: PlayerStatsRow): PlayerStatsComputed {
  return {
    ...row,
    vpip: pct(row.vpip_hands, row.total_hands),
    pfr: pct(row.pfr_hands, row.total_hands),
    threeb: pct(row.threeb_hands, row.threeb_opps),
    fold_to_3b_pct: pct(row.fold_to_3b, row.fold_to_3b_opps),
    limp_pct: pct(row.limp_hands, row.total_hands),
    af: row.af_calls > 0 ? Math.round((row.af_bets_raises / row.af_calls) * 10) / 10 : 0,
    wtsd: pct(row.wtsd_hands, row.wtsd_opps),
  };
}

export async function listPlayerStats(
  minHands: number = 10,
  tableSize: number | null = null
): Promise<PlayerStatsComputed[]> {
  const db = await getDB();

  let sql = `SELECT * FROM player_stats WHERE total_hands >= ?1`;
  const params: (number | string)[] = [minHands];

  if (tableSize !== null) {
    sql += ` AND table_size = ?2`;
    params.push(tableSize);
  }

  sql += ` ORDER BY total_hands DESC, player ASC`;

  try {
    const rows = (await db.select(sql, params)) as PlayerStatsRow[];
    return rows.map(computeStats);
  } catch {
    // Table may not exist yet (Python backend hasn't run)
    return [];
  }
}

export async function getPlayerStatsDetail(
  player: string
): Promise<PlayerStatsComputed[]> {
  const db = await getDB();
  try {
    const rows = (await db.select(
      `SELECT * FROM player_stats WHERE player = ?1 ORDER BY table_size ASC`,
      [player]
    )) as PlayerStatsRow[];
    return rows.map(computeStats);
  } catch {
    return [];
  }
}
