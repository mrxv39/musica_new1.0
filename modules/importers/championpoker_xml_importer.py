# C:\Users\Usuario\Desktop\proyectos\poker_boss\modules\importers\championpoker_xml_importer.py
from __future__ import annotations

import os
import json
import time
import sqlite3
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

from modules.db.migrate_utils import add_column_if_missing, table_exists


# -------------------------
# Action type mapping (inferred from your XML)
# -------------------------
ACTION_TYPE_MAP: Dict[int, str] = {
    0: "FOLD",
    1: "POST_SB",
    2: "POST_BB",
    3: "CALL",
    4: "CHECK",
    5: "BET",
    7: "ALL_IN",
    15: "ANTE",
    23: "RAISE",
}


@dataclass(frozen=True)
class ImportedAction:
    gamecode: str
    round_no: int
    action_no: int
    player: str
    type_id: int
    type_name: str
    sum_chips: float
    sum_bb: float


@dataclass(frozen=True)
class ImportedHand:
    room: str
    hero: str
    tournament_path: str  # folder/source group (optional)
    source_file: str
    gamecode: str
    startdate: str
    sb: float
    bb: float
    hero_cards: str
    flop: str
    turn: str
    river: str
    players_json: Dict[str, Any]
    actions: List[ImportedAction]


@dataclass(frozen=True)
class ImportedTournament:
    room: str
    hero: str
    tournament_path: str
    source_file: str
    general: Dict[str, str]


TOURNAMENT_GENERAL_FIELDS: Tuple[str, ...] = (
    "client_version",
    "mode",
    "gametype",
    "tablename",
    "tournament_currency",
    "duration",
    "game_count",
    "startdate",
    "currency",
    "nickname",
    "bets",
    "wins",
    "chipsin",
    "chipsout",
    "statuspoints",
    "awardpoints",
    "ipoints",
    "tablesize",
    "tournamentcode",
    "tournamentname",
    "rewarddrawn",
    "place",
    "buyin",
    "totalbuyin",
    "win",
    "smallblind",
    "bigblind",
)


# -------------------------
# SQLite schema (v1)
# -------------------------
SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS tournaments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room TEXT NOT NULL DEFAULT '',
    hero TEXT NOT NULL DEFAULT '',
    tournament_path TEXT NOT NULL DEFAULT '',
    source_file TEXT NOT NULL DEFAULT '',
    client_version TEXT NOT NULL DEFAULT '',
    mode TEXT NOT NULL DEFAULT '',
    gametype TEXT NOT NULL DEFAULT '',
    tablename TEXT NOT NULL DEFAULT '',
    tournament_currency TEXT NOT NULL DEFAULT '',
    duration TEXT NOT NULL DEFAULT '',
    game_count TEXT NOT NULL DEFAULT '',
    startdate TEXT NOT NULL DEFAULT '',
    currency TEXT NOT NULL DEFAULT '',
    nickname TEXT NOT NULL DEFAULT '',
    bets TEXT NOT NULL DEFAULT '',
    wins TEXT NOT NULL DEFAULT '',
    chipsin TEXT NOT NULL DEFAULT '',
    chipsout TEXT NOT NULL DEFAULT '',
    statuspoints TEXT NOT NULL DEFAULT '',
    awardpoints TEXT NOT NULL DEFAULT '',
    ipoints TEXT NOT NULL DEFAULT '',
    tablesize TEXT NOT NULL DEFAULT '',
    tournamentcode TEXT NOT NULL DEFAULT '',
    tournamentname TEXT NOT NULL DEFAULT '',
    rewarddrawn TEXT NOT NULL DEFAULT '',
    place TEXT NOT NULL DEFAULT '',
    buyin TEXT NOT NULL DEFAULT '',
    totalbuyin TEXT NOT NULL DEFAULT '',
    win TEXT NOT NULL DEFAULT '',
    smallblind TEXT NOT NULL DEFAULT '',
    bigblind TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(room, hero, source_file)
);

CREATE INDEX IF NOT EXISTS idx_tournaments_source_file ON tournaments(source_file);

CREATE TABLE IF NOT EXISTS hands (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tournament_id INTEGER DEFAULT NULL,
    room TEXT NOT NULL,
    hero TEXT NOT NULL,
    tournament_path TEXT NOT NULL DEFAULT '',
    source_file TEXT NOT NULL,
    gamecode TEXT NOT NULL,
    startdate TEXT NOT NULL DEFAULT '',
    sb REAL NOT NULL DEFAULT 0,
    bb REAL NOT NULL DEFAULT 0,
    hero_cards TEXT NOT NULL DEFAULT '',
    flop TEXT NOT NULL DEFAULT '',
    turn TEXT NOT NULL DEFAULT '',
    river TEXT NOT NULL DEFAULT '',
    players_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY(tournament_id) REFERENCES tournaments(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_hands_unique ON hands(room, hero, gamecode);
CREATE INDEX IF NOT EXISTS idx_hands_tournament_id ON hands(tournament_id);

CREATE TABLE IF NOT EXISTS actions_real (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hand_id INTEGER NOT NULL,
    gamecode TEXT NOT NULL,
    round_no INTEGER NOT NULL,
    action_no INTEGER NOT NULL,
    player TEXT NOT NULL,
    type_id INTEGER NOT NULL,
    type_name TEXT NOT NULL,
    sum_chips REAL NOT NULL DEFAULT 0,
    sum_bb REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY(hand_id) REFERENCES hands(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_actions_real_hand_round_no ON actions_real(hand_id, round_no, action_no);

-- Spots XML real (v1 preflop only)
CREATE TABLE IF NOT EXISTS spots_xml_real (
    spot_id INTEGER PRIMARY KEY AUTOINCREMENT,
    hand_id INTEGER NOT NULL,
    gamecode TEXT,
    site TEXT,
    hero_name TEXT,
    street TEXT NOT NULL,
    spot_index INTEGER NOT NULL,
    action_index INTEGER,
    hero_cards TEXT,
    hero_position TEXT,
    players_count INTEGER,
    effective_stack_bb REAL,
    pot_bb REAL,
    to_call_bb REAL,
    bets_state_json TEXT,
    action_history_json TEXT,
    spot_kind TEXT,
    created_at INTEGER NOT NULL,
    FOREIGN KEY(hand_id) REFERENCES hands(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_spots_xml_real_hand_id
ON spots_xml_real(hand_id);

CREATE INDEX IF NOT EXISTS idx_spots_xml_real_gamecode
ON spots_xml_real(gamecode);

CREATE INDEX IF NOT EXISTS idx_spots_xml_real_hero_cards
ON spots_xml_real(hero_cards);

CREATE INDEX IF NOT EXISTS idx_spots_xml_real_street_spot_index
ON spots_xml_real(street, spot_index);
"""


def ensure_schema(conn: sqlite3.Connection) -> None:
    conn.executescript(SCHEMA_SQL)
    if table_exists(conn, "hands"):
        add_column_if_missing(conn, "hands", "tournament_id", "INTEGER REFERENCES tournaments(id)")
    conn.commit()


def _safe_float(x: Any, default: float = 0.0) -> float:
    try:
        return float(x)
    except Exception:
        return default


def _txt(node: Optional[ET.Element]) -> str:
    if node is None or node.text is None:
        return ""
    return str(node.text).strip()


def _is_unknown_cards(s: str) -> bool:
    """
    Normalize the common "unknown cards" variants we see in these HH.
    """
    if not s:
        return True
    t = "".join(s.split()).upper()  # remove spaces
    return t in {"X", "XX", "X X".replace(" ", "")}  # "XX" covers "X X" too


def _find_hero_pocket_cards_from_game(game: ET.Element, hero: str) -> str:
    """
    Fallback: some XMLs store pocket cards in <cards type="Pocket" player="...">...</cards>.
    We must pick the hero, otherwise we may pick a villain with 'X X'.
    """
    for c in game.findall(".//cards"):
        if (c.get("type") or "") != "Pocket":
            continue
        player = (c.get("player") or "").strip()
        if player != hero:
            continue
        val = _txt(c)
        if val:
            return val
    return ""


def _round_to_street(round_no: int) -> str:
    # ChampionPoker convention (matches your prior rule set)
    # round 1 = preflop, 2=flop, 3=turn, 4=river, 0=blinds/antes
    if round_no <= 1:
        return "PREFLOP"
    if round_no == 2:
        return "FLOP"
    if round_no == 3:
        return "TURN"
    return "RIVER"


def _parse_tournament(xml_path: str, *, room: str, hero: str, tournament_path: str = "") -> ImportedTournament:
    root = ET.parse(xml_path).getroot()
    # Tournament-level data lives in <session><general> in real Champion Poker XMLs,
    # but test fixtures may have it inside <game><general>.
    # Try root-level first, fall back to game/general.
    general = root.find("general")
    general_game = root.find("game/general")

    general_values = {field: "" for field in TOURNAMENT_GENERAL_FIELDS}

    def _get_field(field: str) -> str:
        """Try field name exact, then without underscores, in both general locations."""
        for node in (general, general_game):
            if node is None:
                continue
            val = _txt(node.find(field))
            if val:
                return val
            val = _txt(node.find(field.replace("_", "")))
            if val:
                return val
        return ""

    for field in TOURNAMENT_GENERAL_FIELDS:
        general_values[field] = _get_field(field)

    return ImportedTournament(
        room=room,
        hero=hero,
        tournament_path=tournament_path,
        source_file=os.path.abspath(xml_path),
        general=general_values,
    )


def parse_one_xml_file(
    xml_path: str,
    *,
    room: str,
    hero: str,
    tournament_path: str = "",
) -> List[ImportedHand]:
    root = ET.parse(xml_path).getroot()

    hands: List[ImportedHand] = []
    for game in root.findall("game"):
        gamecode = str(game.attrib.get("gamecode", "") or "").strip()
        if not gamecode:
            continue

        gen = game.find("general")
        if gen is None:
            continue

        sb = _safe_float(_txt(gen.find("smallblind")), 0.0)
        bb = _safe_float(_txt(gen.find("bigblind")), 0.0)
        startdate = _txt(gen.find("startdate"))

        # players
        players_node = gen.find("players")
        players: List[Dict[str, Any]] = []
        if players_node is not None:
            for p in list(players_node):
                if p.tag != "player":
                    continue
                players.append(
                    {
                        "name": str(p.attrib.get("name", "") or ""),
                        "chips": _safe_float(p.attrib.get("chips", 0), 0.0),
                        "dealer": str(p.attrib.get("dealer", "") or ""),
                        "win": str(p.attrib.get("win", "") or ""),
                        "reg_code": str(p.attrib.get("reg_code", "") or ""),
                    }
                )

        players_json: Dict[str, Any] = {"players": players}

        # rounds
        hero_cards = ""
        flop = ""
        turn = ""
        river = ""
        actions: List[ImportedAction] = []

        for rnd in game.findall("round"):
            round_no = int(rnd.attrib.get("no", "-1") or -1)

            # In your files:
            # - round 1 cards = pocket cards per player (pick hero's)
            # - round 2 cards = flop
            # - round 3 cards = turn
            # - round 4 cards = river
            if round_no == 1:
                # Find hero's pocket cards specifically
                for cards_el in rnd.findall("cards"):
                    player = (cards_el.get("player") or "").strip()
                    txt = _txt(cards_el)
                    if player == hero and txt and not _is_unknown_cards(txt):
                        hero_cards = txt
                        break
            else:
                cards_txt = _txt(rnd.find("cards"))
                if round_no == 2 and cards_txt:
                    flop = cards_txt
                elif round_no == 3 and cards_txt:
                    turn = cards_txt
                elif round_no == 4 and cards_txt:
                    river = cards_txt

            for act in rnd.findall("action"):
                a_no = int(act.attrib.get("no", "-1") or -1)
                player = str(act.attrib.get("player", "") or "")
                t_id = int(act.attrib.get("type", "-1") or -1)
                s = _safe_float(act.attrib.get("sum", 0), 0.0)

                # bb conversion
                s_bb = (s / bb) if bb > 0 else 0.0

                t_name = ACTION_TYPE_MAP.get(t_id, f"TYPE_{t_id}")

                actions.append(
                    ImportedAction(
                        gamecode=gamecode,
                        round_no=round_no,
                        action_no=a_no,
                        player=player,
                        type_id=t_id,
                        type_name=t_name,
                        sum_chips=s,
                        sum_bb=s_bb,
                    )
                )

        # FINAL HERO CARDS RESOLUTION (robust)
        # If round 1 didn't give us real cards, try <cards type="Pocket" player="hero">...</cards>
        if not hero_cards or _is_unknown_cards(hero_cards):
            hc = _find_hero_pocket_cards_from_game(game, hero)
            if hc and not _is_unknown_cards(hc):
                hero_cards = hc

        # Hard fallback
        if not hero_cards:
            hero_cards = "X X"

        hands.append(
            ImportedHand(
                room=room,
                hero=hero,
                tournament_path=tournament_path,
                source_file=os.path.abspath(xml_path),
                gamecode=gamecode,
                startdate=startdate,
                sb=sb,
                bb=bb,
                hero_cards=hero_cards,
                flop=flop,
                turn=turn,
                river=river,
                players_json=players_json,
                actions=actions,
            )
        )

    return hands


def _upsert_tournament(conn: sqlite3.Connection, tournament: ImportedTournament) -> int:
    cur = conn.cursor()
    field_names = ", ".join(TOURNAMENT_GENERAL_FIELDS)
    placeholders = ", ".join("?" for _ in TOURNAMENT_GENERAL_FIELDS)
    update_assignments = ", ".join(f"{field}=excluded.{field}" for field in TOURNAMENT_GENERAL_FIELDS)

    cur.execute(
        f"""
        INSERT INTO tournaments(
            room, hero, tournament_path, source_file, {field_names}
        ) VALUES (?, ?, ?, ?, {placeholders})
        ON CONFLICT(room, hero, source_file) DO UPDATE SET
            tournament_path=excluded.tournament_path,
            {update_assignments}
        """,
        (
            tournament.room,
            tournament.hero,
            tournament.tournament_path,
            tournament.source_file,
            *(tournament.general[field] for field in TOURNAMENT_GENERAL_FIELDS),
        ),
    )
    cur.execute(
        "SELECT id FROM tournaments WHERE room=? AND hero=? AND source_file=?",
        (tournament.room, tournament.hero, tournament.source_file),
    )
    row = cur.fetchone()
    if not row:
        raise RuntimeError("Failed to insert/fetch tournament row")
    return int(row[0])


def _insert_hand(conn: sqlite3.Connection, hand: ImportedHand, tournament_id: Optional[int]) -> int:
    cur = conn.cursor()

    cur.execute(
        """
        INSERT INTO hands(
            tournament_id, room, hero, tournament_path, source_file, gamecode, startdate,
            sb, bb, hero_cards, flop, turn, river, players_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(room, hero, gamecode) DO UPDATE SET
            tournament_id=excluded.tournament_id,
            tournament_path=excluded.tournament_path,
            source_file=excluded.source_file,
            startdate=excluded.startdate,
            sb=excluded.sb,
            bb=excluded.bb,
            hero_cards=excluded.hero_cards,
            flop=excluded.flop,
            turn=excluded.turn,
            river=excluded.river,
            players_json=excluded.players_json
        """,
        (
            tournament_id,
            hand.room,
            hand.hero,
            hand.tournament_path,
            hand.source_file,
            hand.gamecode,
            hand.startdate,
            hand.sb,
            hand.bb,
            hand.hero_cards,
            hand.flop,
            hand.turn,
            hand.river,
            json.dumps(hand.players_json, ensure_ascii=False),
        ),
    )

    # If existed, fetch id
    cur.execute(
        "SELECT id FROM hands WHERE room=? AND hero=? AND gamecode=?",
        (hand.room, hand.hero, hand.gamecode),
    )
    row = cur.fetchone()
    if not row:
        raise RuntimeError("Failed to insert/fetch hands row")
    return int(row[0])


def _insert_actions(conn: sqlite3.Connection, hand_id: int, hand: ImportedHand) -> None:
    cur = conn.cursor()
    # idempotency: delete actions for this hand_id then insert fresh
    cur.execute("DELETE FROM actions_real WHERE hand_id=?", (hand_id,))

    cur.executemany(
        """
        INSERT INTO actions_real(
            hand_id, gamecode, round_no, action_no, player, type_id, type_name, sum_chips, sum_bb
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        [
            (
                hand_id,
                a.gamecode,
                a.round_no,
                a.action_no,
                a.player,
                a.type_id,
                a.type_name,
                a.sum_chips,
                a.sum_bb,
            )
            for a in sorted(hand.actions, key=lambda x: (x.round_no, x.action_no))
        ],
    )


def _spot_kind_from_action_type(type_name: str) -> str:
    t = (type_name or "").upper()
    if t in {"POST_SB", "POST_BB", "ANTE"}:
        return "forced_bet"
    if t == "FOLD":
        return "facing_decision_fold"
    if t == "CHECK":
        return "check_option"
    if t == "CALL":
        return "facing_call"
    if t == "RAISE":
        return "facing_raise_or_iso"
    if t == "ALL_IN":
        return "facing_all_in"
    if t == "BET":
        return "bet_decision"
    return "unknown"


def _extract_preflop_spots_xml_real(hand: ImportedHand) -> List[Dict[str, Any]]:
    actions = sorted(hand.actions, key=lambda x: (x.round_no, x.action_no))
    preflop_actions = [a for a in actions if a.round_no == 1]

    players_count = len((hand.players_json or {}).get("players", []))
    history: List[Dict[str, Any]] = []
    spots: List[Dict[str, Any]] = []
    spot_index = 0

    for a in preflop_actions:
        action_row = {
            "player": a.player,
            "type_id": a.type_id,
            "type_name": a.type_name,
            "sum_chips": a.sum_chips,
            "sum_bb": a.sum_bb,
            "round_no": a.round_no,
            "action_no": a.action_no,
        }

        if a.player == hand.hero:
            spot_index += 1
            spots.append(
                {
                    "hand_id": None,  # se completa en insert
                    "gamecode": hand.gamecode,
                    "site": hand.room,
                    "hero_name": hand.hero,
                    "street": "preflop",
                    "spot_index": spot_index,
                    "action_index": a.action_no,
                    "hero_cards": hand.hero_cards,
                    "hero_position": None,
                    "players_count": players_count,
                    "effective_stack_bb": None,
                    "pot_bb": None,
                    "to_call_bb": None,
                    "bets_state_json": json.dumps(
                        {
                            "hero_action_type": a.type_name,
                            "hero_action_sum_bb": a.sum_bb,
                            "hero_action_sum_chips": a.sum_chips,
                        },
                        ensure_ascii=False,
                    ),
                    "action_history_json": json.dumps(history, ensure_ascii=False),
                    "spot_kind": _spot_kind_from_action_type(a.type_name),
                    "created_at": int(time.time() * 1000),
                }
            )

        history.append(action_row)

    return spots


def _insert_spots_xml_real(conn: sqlite3.Connection, hand_id: int, hand: ImportedHand) -> int:
    cur = conn.cursor()
    cur.execute("DELETE FROM spots_xml_real WHERE hand_id=?", (hand_id,))

    spots = _extract_preflop_spots_xml_real(hand)
    if not spots:
        return 0

    cur.executemany(
        """
        INSERT INTO spots_xml_real(
            hand_id, gamecode, site, hero_name, street, spot_index, action_index,
            hero_cards, hero_position, players_count, effective_stack_bb, pot_bb,
            to_call_bb, bets_state_json, action_history_json, spot_kind, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        [
            (
                hand_id,
                s["gamecode"],
                s["site"],
                s["hero_name"],
                s["street"],
                int(s["spot_index"]),
                int(s["action_index"]),
                s["hero_cards"],
                s["hero_position"],
                s["players_count"],
                s["effective_stack_bb"],
                s["pot_bb"],
                s["to_call_bb"],
                s["bets_state_json"],
                s["action_history_json"],
                s["spot_kind"],
                int(s["created_at"]),
            )
            for s in spots
        ],
    )
    return len(spots)


def import_xml_folder(
    *,
    folder: str,
    db_path: str,
    room: str,
    hero: str,
    tournament_path: str = "",
    recursive: bool = True,
    verbose: bool = True,
) -> Dict[str, Any]:
    folder = os.path.abspath(folder)
    db_path = os.path.abspath(db_path)

    if not os.path.isdir(folder):
        raise FileNotFoundError(f"Folder not found: {folder}")

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    try:
        ensure_schema(conn)

        xml_files: List[str] = []
        if recursive:
            for root, _dirs, files in os.walk(folder):
                for fn in files:
                    if fn.lower().endswith(".xml"):
                        xml_files.append(os.path.join(root, fn))
        else:
            for fn in os.listdir(folder):
                if fn.lower().endswith(".xml"):
                    xml_files.append(os.path.join(folder, fn))

        total_files = len(xml_files)
        total_hands = 0
        total_spots_xml_real = 0

        for i, xp in enumerate(sorted(xml_files)):
            try:
                tournament = _parse_tournament(xp, room=room, hero=hero, tournament_path=tournament_path)
                hands = parse_one_xml_file(xp, room=room, hero=hero, tournament_path=tournament_path)
            except Exception as e:
                if verbose:
                    print(f"[IMPORT] file {i+1}/{total_files} FAIL: {xp} -> {type(e).__name__}: {e}")
                continue

            tournament_id = _upsert_tournament(conn, tournament)
            for h in hands:
                hand_id = _insert_hand(conn, h, tournament_id)
                _insert_actions(conn, hand_id, h)
                total_spots_xml_real += _insert_spots_xml_real(conn, hand_id, h)
                total_hands += 1

            conn.commit()

            if verbose:
                print(f"[IMPORT] {i+1}/{total_files} OK: {os.path.basename(xp)} -> hands={len(hands)}")

        return {
            "ok": True,
            "folder": folder,
            "db_path": db_path,
            "room": room,
            "hero": hero,
            "xml_files": total_files,
            "hands_imported": total_hands,
            "spots_xml_real_imported": total_spots_xml_real,
        }
    finally:
        conn.close()
