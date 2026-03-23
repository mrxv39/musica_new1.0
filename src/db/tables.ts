/** Data access for tournaments, hands, and spots tables. */

import { getDB } from "./sql";

export type TournamentRow = {
  id: number;
  room: string;
  hero: string;
  gametype: string;
  tablename: string;
  tablesize: string;
  tournamentname: string;
  tournamentcode: string;
  place: string;
  buyin: string;
  totalbuyin: string;
  win: string;
  game_count: string;
  duration: string;
  startdate: string;
};

export type HandRow = {
  id: number;
  tournament_id: number;
  gamecode: string;
  hero_cards: string;
  sb: number;
  bb: number;
  flop: string;
  turn: string;
  river: string;
  startdate: string;
};

export type SpotRow = {
  obs_id: number;
  table_id: string;
  hand_class: string;
  p1_se_bb: number | null;
  p1_pos: string;
  p2_pos: string;
  p2_tipo: string;
  p3_pos: string;
  p3_tipo: string;
  captured_gamecode: string;
  linked_hand_id: number | null;
  detected_at_ms: number;
};

export async function listTournaments(limit = 200): Promise<TournamentRow[]> {
  const db = await getDB();
  return (await db.select(
    `SELECT id, room, hero, gametype, tablename, tablesize, tournamentname,
            tournamentcode, place, buyin, totalbuyin, win, game_count, duration, startdate
     FROM tournaments ORDER BY startdate DESC LIMIT ?1`,
    [limit]
  )) as TournamentRow[];
}

export async function listHands(limit = 200): Promise<HandRow[]> {
  const db = await getDB();
  return (await db.select(
    `SELECT id, tournament_id, gamecode, hero_cards, sb, bb, flop, turn, river, startdate
     FROM hands ORDER BY id DESC LIMIT ?1`,
    [limit]
  )) as HandRow[];
}

export async function listSpotsCaptures(limit = 200): Promise<SpotRow[]> {
  const db = await getDB();
  return (await db.select(
    `SELECT obs_id, table_id, hand_class, p1_se_bb, p1_pos, p2_pos, p2_tipo,
            p3_pos, p3_tipo, captured_gamecode, linked_hand_id, detected_at_ms
     FROM spots ORDER BY detected_at_ms DESC LIMIT ?1`,
    [limit]
  )) as SpotRow[];
}
