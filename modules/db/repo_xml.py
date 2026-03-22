# modules/db/repo_xml.py
from __future__ import annotations

from typing import Any, Dict, Optional

from .conn import connect
from .migrate import init_db, now_ms


def upsert_xml_game(
    *,
    gamecode: str,
    sessioncode: str = "",
    startdate: str = "",
    smallblind: str = "",
    bigblind: str = "",
    hero_reg_code: str = "",
    hero_name: str = "",
    hero_seat: str = "",
    hero_cards: str = "",
    board_flop: str = "",
    board_turn: str = "",
    board_river: str = "",
    players_json: str = "",
    actions_json: str = "",
) -> Optional[str]:
    if not gamecode:
        return None

    init_db()
    with connect() as conn:
        cur = conn.cursor()
        cur.execute(
            '''
            INSERT INTO hands_xml
            (gamecode, sessioncode, startdate, smallblind, bigblind,
             hero_reg_code, hero_name, hero_seat, hero_cards,
             board_flop, board_turn, board_river,
             players_json, actions_json, created_at_ms)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(gamecode) DO UPDATE SET
             sessioncode=excluded.sessioncode,
             startdate=excluded.startdate,
             smallblind=excluded.smallblind,
             bigblind=excluded.bigblind,
             hero_reg_code=excluded.hero_reg_code,
             hero_name=excluded.hero_name,
             hero_seat=excluded.hero_seat,
             hero_cards=excluded.hero_cards,
             board_flop=excluded.board_flop,
             board_turn=excluded.board_turn,
             board_river=excluded.board_river,
             players_json=excluded.players_json,
             actions_json=excluded.actions_json
            ''',
            (
                gamecode,
                sessioncode or "",
                startdate or "",
                smallblind or "",
                bigblind or "",
                hero_reg_code or "",
                hero_name or "",
                hero_seat or "",
                hero_cards or "",
                board_flop or "",
                board_turn or "",
                board_river or "",
                players_json or "",
                actions_json or "",
                now_ms(),
            ),
        )
        conn.commit()
        return gamecode


def get_xml_by_gamecode(gamecode: str) -> Optional[Dict[str, Any]]:
    init_db()
    with connect() as conn:
        cur = conn.cursor()
        cur.execute("SELECT * FROM hands_xml WHERE gamecode = ?", (gamecode,))
        row = cur.fetchone()
        return dict(row) if row else None


def link_obs_to_game(
    *,
    obs_id: int,
    gamecode: str,
    match_score: float = 0.0,
    match_method: str = "",
) -> Optional[int]:
    """Link a spot to a hand by setting spots.hand_id from gamecode lookup."""
    if not obs_id or not gamecode:
        return None

    init_db()
    with connect() as conn:
        cur = conn.cursor()
        cur.execute("SELECT id FROM hands WHERE gamecode = ? LIMIT 1", (gamecode,))
        row = cur.fetchone()
        if not row:
            return None
        hand_id = int(row["id"])
        cur.execute(
            "UPDATE spots SET hand_id = ? WHERE obs_id = ?",
            (hand_id, int(obs_id)),
        )
        conn.commit()
        return hand_id
