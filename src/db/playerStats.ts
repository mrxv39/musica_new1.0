/**
 * Data access for player_stats table.
 *
 * Table already exists in DB with columns:
 *   player, table_size, total_hands, vpip_hands, pfr_hands,
 *   threeb_hands, threeb_opps, fold_to_3b, fold_to_3b_opps,
 *   fourb_hands, fourb_opps, limp_hands,
 *   af_bets_raises, af_calls, wtsd_hands, wtsd_opps,
 *   won_hands, total_won_chips, total_bet_chips, updated_at
 */

import { getDB } from "./sql";

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

export type ComputedStats = PlayerStatsRow & {
  vpip: number;
  pfr: number;
  threeb: number;
  fold3b: number;
  fourb: number;
  limp: number;
  af: number;
  wtsd: number;
  winrate: number;
};

function pct(num: number, den: number): number {
  return den > 0 ? Math.round((num / den) * 1000) / 10 : 0;
}

export function computeStats(r: PlayerStatsRow): ComputedStats {
  return {
    ...r,
    vpip: pct(r.vpip_hands, r.total_hands),
    pfr: pct(r.pfr_hands, r.total_hands),
    threeb: pct(r.threeb_hands, r.threeb_opps),
    fold3b: pct(r.fold_to_3b, r.fold_to_3b_opps),
    fourb: pct(r.fourb_hands, r.fourb_opps),
    limp: pct(r.limp_hands, r.total_hands),
    af: r.af_calls > 0 ? Math.round((r.af_bets_raises / r.af_calls) * 10) / 10 : 0,
    wtsd: pct(r.wtsd_hands, r.wtsd_opps),
    winrate: pct(r.won_hands, r.total_hands),
  };
}

export async function listPlayerStats(): Promise<ComputedStats[]> {
  const db = await getDB();
  const rows = (await db.select(
    `SELECT * FROM player_stats ORDER BY total_hands DESC`
  )) as PlayerStatsRow[];
  return rows.map(computeStats);
}
