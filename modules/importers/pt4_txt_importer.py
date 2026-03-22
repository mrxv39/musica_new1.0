# C:\Users\Usuario\Desktop\proyectos\poker_boss\modules\importers\pt4_txt_importer.py
# Importer for PokerTracker 4 iPoker Network text hand history exports.
#
# Format: plain text, one or more hands per file, separated by blank lines.
# Each hand has:
#   GAME #<gamecode> Version:<ver> ... Tournament <date>/GMT
#   Table Size <n>
#   Table <name>, <table_id>, <tournament_id> (Tournament: <name> Buy-In: <buyin>)
#   Seat <n>: <player> (€<chips>) [DEALER]
#   <actions per street>
#   *** SUMMARY ***

from __future__ import annotations

import json
import os
import re
import sqlite3
import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

from modules.importers.championpoker_xml_importer import (
    ImportedAction,
    ImportedHand,
    ImportedTournament,
    TOURNAMENT_GENERAL_FIELDS,
    ensure_schema,
    _upsert_tournament,
    _insert_hand,
    _insert_actions,
    _insert_spots_xml_real,
)

# ── regexes ──────────────────────────────────────────────────────────────

_RE_GAME = re.compile(
    r"^GAME #(\d+)\s+Version:(\S+)\s+.*?Texas Hold'em NL\s+Tournament\s+"
    r"(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})/GMT",
)

_RE_TABLE_SIZE = re.compile(r"^Table Size (\d+)")

_RE_TABLE = re.compile(
    r"^Table (.+?),\s*(\d+),\s*(\d+)\s*"
    r"\(Tournament:\s*(.+?)\s+Buy-In:\s*(.+?)\)"
)

_RE_SEAT = re.compile(
    r"^Seat (\d+):\s+(.+?)\s+\(.(\d[\d,.]*)\s+in chips\)(\s+DEALER)?"
)

_RE_DEALT = re.compile(r"^Dealt to (.+?) \[(.+?)\]")

_RE_STREET = re.compile(r"^\*\*\* (HOLE CARDS|FLOP|TURN|RIVER|SUMMARY) \*\*\*(?:\s+\[(.+?)\])?")

_RE_ACTION = re.compile(
    r"^(.+?):\s+(Post SB|Post BB|Post Ante|Fold|Call|Check|Bet|Raise \(NF\)|Allin)\s*.?(\d[\d,.]*)?$"
)

_RE_SHOW = re.compile(r"^(.+?):\s+Shows\s+\[(.+?)\]")
_RE_MUCK = re.compile(r"^(.+?):\s+Mucks\s+\[(.+?)\]")
_RE_WINS = re.compile(r"^(.+?):\s+wins\s+.?(\d[\d,.]*)")
_RE_POT = re.compile(r"^Total pot .?(\d[\d,.]*)\s+Rake .?(\d[\d,.]*)")

# ── action type mapping (match championpoker convention) ─────────────

ACTION_NAME_TO_ID: Dict[str, int] = {
    "Post SB": 1,
    "Post BB": 2,
    "Post Ante": 15,
    "Fold": 0,
    "Call": 3,
    "Check": 4,
    "Bet": 5,
    "Raise (NF)": 23,
    "Allin": 7,
}

ACTION_NAME_MAP: Dict[str, str] = {
    "Post SB": "POST_SB",
    "Post BB": "POST_BB",
    "Post Ante": "ANTE",
    "Fold": "FOLD",
    "Call": "CALL",
    "Check": "CHECK",
    "Bet": "BET",
    "Raise (NF)": "RAISE",
    "Allin": "ALL_IN",
}


def _parse_chips(s: str) -> float:
    """Parse '1,225.00' or '500.00' or '10' to float."""
    if not s:
        return 0.0
    cleaned = s.replace(",", "").replace("\u20ac", "").replace("€", "").strip()
    try:
        return float(cleaned)
    except ValueError:
        return 0.0


def _street_to_round(street: str) -> int:
    """Map street name to round number (championpoker convention)."""
    s = street.upper()
    if s == "HOLE CARDS":
        return 1
    if s == "FLOP":
        return 2
    if s == "TURN":
        return 3
    if s == "RIVER":
        return 4
    return 0  # antes/blinds pre-street


def _parse_one_hand(
    text: str,
    *,
    hero: str,
    room: str,
    source_file: str,
) -> Optional[Tuple[ImportedHand, Dict[str, str]]]:
    """Parse a single hand text block. Returns (ImportedHand, tournament_meta) or None."""

    lines = text.strip().split("\n")
    if not lines:
        return None

    # Line 0: GAME header
    m_game = _RE_GAME.match(lines[0])
    if not m_game:
        return None

    gamecode = m_game.group(1)
    version = m_game.group(2)
    startdate = m_game.group(3)

    # Line 1: Table Size
    table_size = "3"
    if len(lines) > 1:
        m_ts = _RE_TABLE_SIZE.match(lines[1])
        if m_ts:
            table_size = m_ts.group(1)

    # Line 2: Table info
    tournament_name = ""
    table_id = ""
    tournament_code = ""
    buyin_str = ""
    tablename = ""
    if len(lines) > 2:
        m_tbl = _RE_TABLE.match(lines[2])
        if m_tbl:
            tablename = m_tbl.group(1).strip()
            table_id = m_tbl.group(2)
            tournament_code = m_tbl.group(3)
            tournament_name = m_tbl.group(4).strip()
            buyin_str = m_tbl.group(5).strip()

    # Seats
    players: List[Dict[str, Any]] = []
    dealer_name = ""
    for line in lines:
        m_seat = _RE_SEAT.match(line)
        if m_seat:
            seat_no = int(m_seat.group(1))
            name = m_seat.group(2).strip()
            chips = _parse_chips(m_seat.group(3))
            is_dealer = bool(m_seat.group(4))
            players.append({
                "name": name,
                "chips": chips,
                "dealer": "1" if is_dealer else "0",
                "win": "0",
                "reg_code": "",
                "seat": seat_no,
            })
            if is_dealer:
                dealer_name = name

    # Parse streets and actions
    hero_cards = ""
    flop = ""
    turn = ""
    river = ""
    actions: List[ImportedAction] = []
    current_round = 0  # 0 = blinds/antes
    action_no = 0
    sb = 0.0
    bb = 0.0
    showdown_cards: Dict[str, str] = {}
    winner = ""
    win_amount = 0.0

    for line in lines:
        # Street marker
        m_street = _RE_STREET.match(line)
        if m_street:
            street_name = m_street.group(1)
            cards_str = m_street.group(2) or ""
            current_round = _street_to_round(street_name)
            if street_name == "FLOP" and cards_str:
                flop = cards_str
            elif street_name == "TURN" and cards_str:
                turn = cards_str
            elif street_name == "RIVER" and cards_str:
                river = cards_str
            continue

        # Dealt to hero
        m_dealt = _RE_DEALT.match(line)
        if m_dealt:
            if m_dealt.group(1).strip() == hero:
                hero_cards = m_dealt.group(2)
            continue

        # Action
        m_act = _RE_ACTION.match(line)
        if m_act:
            player = m_act.group(1).strip()
            act_type = m_act.group(2)
            amount = _parse_chips(m_act.group(3)) if m_act.group(3) else 0.0

            # Detect blinds from Post SB/BB before HOLE CARDS
            if act_type == "Post SB" and sb == 0:
                sb = amount
            elif act_type == "Post BB" and bb == 0:
                bb = amount

            type_id = ACTION_NAME_TO_ID.get(act_type, -1)
            type_name = ACTION_NAME_MAP.get(act_type, act_type)

            action_no += 1
            # For blinds/antes before HOLE CARDS, use round 0
            round_no = current_round if current_round > 0 else 0
            # But blinds are typically round 0 in championpoker convention
            if act_type in ("Post SB", "Post BB", "Post Ante"):
                round_no = 0

            sum_bb = (amount / bb) if bb > 0 else 0.0

            actions.append(ImportedAction(
                gamecode=gamecode,
                round_no=round_no,
                action_no=action_no,
                player=player,
                type_id=type_id,
                type_name=type_name,
                sum_chips=amount,
                sum_bb=sum_bb,
            ))
            continue

        # Shows / Mucks (summary)
        m_show = _RE_SHOW.match(line)
        if m_show:
            p = m_show.group(1).strip()
            showdown_cards[p] = m_show.group(2)
            # Update player win info
            continue

        m_muck = _RE_MUCK.match(line)
        if m_muck:
            p = m_muck.group(1).strip()
            showdown_cards[p] = m_muck.group(2)
            continue

        m_wins = _RE_WINS.match(line)
        if m_wins:
            winner = m_wins.group(1).strip()
            win_amount = _parse_chips(m_wins.group(2))
            for p in players:
                if p["name"] == winner:
                    p["win"] = str(win_amount)
            continue

    if not hero_cards:
        hero_cards = "X X"

    # Tournament meta for grouping
    tournament_meta = {
        "tournament_code": tournament_code,
        "tournament_name": tournament_name,
        "buyin": buyin_str,
        "tablename": tablename,
        "table_size": table_size,
        "version": version,
    }

    hand = ImportedHand(
        room=room,
        hero=hero,
        tournament_path="",
        source_file=source_file,
        gamecode=gamecode,
        startdate=startdate,
        sb=sb,
        bb=bb,
        hero_cards=hero_cards,
        flop=flop,
        turn=turn,
        river=river,
        players_json={"players": players},
        actions=actions,
    )

    return hand, tournament_meta


def _build_tournament(
    meta: Dict[str, str],
    *,
    room: str,
    hero: str,
    source_file: str,
    hands_in_tournament: int,
    first_date: str,
    last_date: str,
) -> ImportedTournament:
    """Build a tournament from aggregated metadata."""
    buyin_raw = meta.get("buyin", "")
    # Parse "€0.93 + €0.07" -> totalbuyin
    parts = re.findall(r"[\d,.]+", buyin_raw)
    total_buyin = sum(_parse_chips(p) for p in parts) if parts else 0.0

    general: Dict[str, str] = {f: "" for f in TOURNAMENT_GENERAL_FIELDS}
    general["client_version"] = meta.get("version", "")
    general["mode"] = "real"
    general["gametype"] = "Holdem NL"
    general["tablename"] = meta.get("tablename", "")
    general["tournament_currency"] = "EUR"
    general["game_count"] = str(hands_in_tournament)
    general["startdate"] = first_date
    general["currency"] = "EUR"
    general["nickname"] = hero
    general["tablesize"] = meta.get("table_size", "3")
    general["tournamentcode"] = meta.get("tournament_code", "")
    general["tournamentname"] = meta.get("tournament_name", "")
    general["buyin"] = buyin_raw
    general["totalbuyin"] = f"{total_buyin:.2f}" if total_buyin else ""
    general["chipsin"] = "500"

    return ImportedTournament(
        room=room,
        hero=hero,
        tournament_path="",
        source_file=source_file,
        general=general,
    )


def parse_pt4_file(
    file_path: str,
    *,
    room: str = "championpoker",
    hero: str = "xavieeee2",
) -> Tuple[List[ImportedHand], Dict[str, Dict[str, Any]], Dict[str, str]]:
    """Parse a PT4 text export file.

    Returns (hands, tournaments_meta, gc_to_tc).
    - tournaments_meta: keyed by tournament_code
    - gc_to_tc: maps gamecode -> tournament_code
    """
    with open(file_path, "r", encoding="utf-8-sig", errors="replace") as f:
        content = f.read()

    blocks = re.split(r"\n{2,}", content.strip())
    source = os.path.abspath(file_path)

    hands: List[ImportedHand] = []
    tournaments_meta: Dict[str, Dict[str, Any]] = {}
    gc_to_tc: Dict[str, str] = {}

    for block in blocks:
        block = block.strip()
        if not block or not block.startswith("GAME #"):
            continue

        result = _parse_one_hand(block, hero=hero, room=room, source_file=source)
        if result is None:
            continue

        hand, meta = result
        hands.append(hand)

        tc = meta["tournament_code"]
        gc_to_tc[hand.gamecode] = tc

        if tc not in tournaments_meta:
            tournaments_meta[tc] = {
                "meta": meta,
                "hands_count": 0,
                "first_date": hand.startdate,
                "last_date": hand.startdate,
            }
        tournaments_meta[tc]["hands_count"] += 1
        if hand.startdate < tournaments_meta[tc]["first_date"]:
            tournaments_meta[tc]["first_date"] = hand.startdate
        if hand.startdate > tournaments_meta[tc]["last_date"]:
            tournaments_meta[tc]["last_date"] = hand.startdate

    return hands, tournaments_meta, gc_to_tc


def import_pt4_folder(
    *,
    folder: str,
    db_path: str,
    room: str = "championpoker",
    hero: str = "xavieeee2",
    verbose: bool = True,
) -> Dict[str, Any]:
    """Import all PT4 text files from a folder into the database."""
    folder = os.path.abspath(folder)
    db_path = os.path.abspath(db_path)

    if not os.path.isdir(folder):
        raise FileNotFoundError(f"Folder not found: {folder}")

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    try:
        ensure_schema(conn)

        txt_files = sorted(
            os.path.join(folder, f)
            for f in os.listdir(folder)
            if f.lower().endswith(".txt")
        )

        total_files = len(txt_files)
        total_hands = 0
        total_tournaments = 0
        total_spots = 0
        skipped_hands = 0

        for i, fp in enumerate(txt_files):
            try:
                hands, tmeta, gc_to_tc = parse_pt4_file(fp, room=room, hero=hero)
            except Exception as e:
                if verbose:
                    print(f"[PT4] file {i+1}/{total_files} FAIL: {os.path.basename(fp)} -> {e}")
                continue

            # Upsert tournaments for this file
            tournament_ids: Dict[str, int] = {}
            for tc, tdata in tmeta.items():
                source_for_tournament = f"pt4_tourney_{tc}"
                tourn = _build_tournament(
                    tdata["meta"],
                    room=room,
                    hero=hero,
                    source_file=source_for_tournament,
                    hands_in_tournament=tdata["hands_count"],
                    first_date=tdata["first_date"],
                    last_date=tdata["last_date"],
                )
                tid = _upsert_tournament(conn, tourn)
                tournament_ids[tc] = tid
                total_tournaments += 1

            # Insert hands
            file_hands = 0
            for hand in hands:
                tc = gc_to_tc.get(hand.gamecode, "")
                tid = tournament_ids.get(tc)
                try:
                    hand_id = _insert_hand(conn, hand, tid)
                    _insert_actions(conn, hand_id, hand)
                    total_spots += _insert_spots_xml_real(conn, hand_id, hand)
                    file_hands += 1
                except Exception as e:
                    skipped_hands += 1

            conn.commit()
            total_hands += file_hands

            if verbose:
                print(
                    f"[PT4] {i+1}/{total_files} OK: {os.path.basename(fp)} "
                    f"-> hands={file_hands}, tournaments={len(tmeta)}"
                )

        return {
            "ok": True,
            "folder": folder,
            "db_path": db_path,
            "room": room,
            "hero": hero,
            "txt_files": total_files,
            "hands_imported": total_hands,
            "tournaments_imported": total_tournaments,
            "spots_xml_real_imported": total_spots,
            "skipped_hands": skipped_hands,
        }
    finally:
        conn.close()
