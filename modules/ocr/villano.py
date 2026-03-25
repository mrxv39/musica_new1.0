# C:\Users\Usuario\Desktop\proyectos\poker_boss\modules\ocr\villano.py
# OCR-based villano classification using player names and SQLite DB.
# Resolves OCR names via XML-imported hands (same tournament) before falling back.

from __future__ import annotations
import json
from typing import Dict, Any

from modules.ocr import names as ocr_names
from modules.db import db as dbmod

MIN_NAME_LENGTH = 3  # ignore OCR noise shorter than this


def ensure_players_tables(conn):
    """Ensure players and player_aliases tables exist (idempotent)."""
    conn.execute("""
        CREATE TABLE IF NOT EXISTS players (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            tipo TEXT NOT NULL DEFAULT 'fish',
            notes TEXT NOT NULL DEFAULT '',
            created_at TEXT DEFAULT (datetime('now'))
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS player_aliases (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            alias TEXT UNIQUE NOT NULL,
            player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
            source TEXT NOT NULL DEFAULT 'manual',
            created_at TEXT DEFAULT (datetime('now'))
        )
    """)


def _get_xml_names_for_tournament(conn, tournament_id: int, hero: str = "xavieeee2") -> list[str]:
    """
    Get all unique real villain names from XML hands in this tournament.
    Returns list of canonical names (excluding hero).
    """
    rows = conn.execute(
        "SELECT players_json FROM hands WHERE tournament_id=? AND players_json != ''",
        (tournament_id,),
    ).fetchall()

    names: set[str] = set()
    hero_lower = hero.lower()
    for (pj_raw,) in rows:
        try:
            data = json.loads(pj_raw)
            players = data if isinstance(data, list) else data.get("players", [])
            for p in players:
                n = (p.get("name") or "").strip()
                if n and n.lower() != hero_lower:
                    names.add(n)
        except (json.JSONDecodeError, TypeError):
            continue
    return list(names)


def _resolve_via_xml(conn, ocr_name: str, gamecode: str) -> tuple[str, int] | None:
    """
    Try to resolve an OCR name by finding the XML hand with the same gamecode,
    then matching against the real villain names in that tournament.

    Returns (canonical_name, player_id) or None.
    """
    if not gamecode:
        return None

    # Find the hand and its tournament
    row = conn.execute(
        "SELECT tournament_id, players_json FROM hands WHERE gamecode=?",
        (gamecode,),
    ).fetchone()
    if not row:
        return None

    tournament_id, pj_raw = row

    # Extract real names from THIS hand first
    real_names: list[str] = []
    try:
        data = json.loads(pj_raw)
        players = data if isinstance(data, list) else data.get("players", [])
        for p in players:
            n = (p.get("name") or "").strip()
            if n and n.lower() != "xavieeee2":
                real_names.append(n)
    except (json.JSONDecodeError, TypeError):
        pass

    if not real_names:
        return None

    # Direct match: OCR name IS the real name (case-insensitive)
    for rn in real_names:
        if rn.lower() == ocr_name.lower():
            pid = _ensure_player(conn, rn)
            return rn, pid

    # Check if OCR name is already a known alias
    row = conn.execute(
        "SELECT p.name, p.id FROM player_aliases a JOIN players p ON a.player_id = p.id WHERE a.alias=?",
        (ocr_name,),
    ).fetchone()
    if row:
        return row[0], row[1]

    # Tournament context match: if this hand has only 1 villain,
    # the OCR name MUST be that villain (HU or 3-handed with only 1 unknown)
    if len(real_names) == 1:
        canonical = real_names[0]
        pid = _ensure_player(conn, canonical)
        # Auto-register alias
        conn.execute(
            "INSERT OR IGNORE INTO player_aliases (alias, player_id, source) VALUES (?, ?, 'xml_gamecode')",
            (ocr_name, pid),
        )
        return canonical, pid

    # Multiple villains: try to narrow down via tournament context
    if tournament_id:
        all_tournament_names = _get_xml_names_for_tournament(conn, tournament_id)
        for tn in all_tournament_names:
            if tn.lower() == ocr_name.lower():
                pid = _ensure_player(conn, tn)
                return tn, pid

    return None


def _ensure_player(conn, name: str) -> int:
    """Ensure player exists in players table, return id."""
    row = conn.execute("SELECT id FROM players WHERE name=?", (name,)).fetchone()
    if row:
        return row[0]
    conn.execute("INSERT OR IGNORE INTO players (name, tipo) VALUES (?, 'fish')", (name,))
    row = conn.execute("SELECT id FROM players WHERE name=?", (name,)).fetchone()
    return row[0]


def resolve_name(conn, ocr_name: str, gamecode: str = "") -> tuple[str, str]:
    """
    Resolve an OCR name to (canonical_name, tipo).
    Pipeline:
      0) Discard noise (short names)
      1) Exact match in players
      2) Exact alias match
      3) XML-based resolution (same gamecode -> same tournament -> real names)
      4) Insert as new player
    Returns (name, tipo).
    """
    if len(ocr_name) < MIN_NAME_LENGTH:
        return "", ""

    # 1. Exact match in players
    row = conn.execute("SELECT name, tipo FROM players WHERE name=?", (ocr_name,)).fetchone()
    if row:
        return row[0], row[1]

    # 2. Exact alias match
    row = conn.execute(
        "SELECT p.name, p.tipo FROM player_aliases a JOIN players p ON a.player_id = p.id WHERE a.alias=?",
        (ocr_name,),
    ).fetchone()
    if row:
        return row[0], row[1]

    # 3. XML-based resolution
    xml_result = _resolve_via_xml(conn, ocr_name, gamecode)
    if xml_result:
        canonical, pid = xml_result
        tipo = conn.execute("SELECT tipo FROM players WHERE id=?", (pid,)).fetchone()[0]
        return canonical, tipo

    # 4. No match — insert as new player
    conn.execute("INSERT OR IGNORE INTO players (name, tipo) VALUES (?, 'fish')", (ocr_name,))
    return ocr_name, "fish"


def classify_villano(
    image_path: str,
    x1: int = 0,
    y1: int = 0,
    p2_name: str = "",
    p3_name: str = "",
    gamecode: str = "",
) -> Dict[str, Any]:
    """
    Classify villains by resolving OCR names to canonical players.
    Uses gamecode to cross-reference XML-imported hand data.
    """
    out: Dict[str, Any] = {
        "ok": False,
        "p2": {"name": "", "tipo": ""},
        "p3": {"name": "", "tipo": ""},
        "created": [],
        "errors": [],
    }

    p2_name = (p2_name or "").strip()
    p3_name = (p3_name or "").strip()
    gamecode = (gamecode or "").strip()

    if not p2_name and not p3_name:
        names = ocr_names.read_names(image_path, x1=x1, y1=y1)
        p2_name = (names.get("p2_name", "") or "").strip()
        p3_name = (names.get("p3_name", "") or "").strip()

    conn = dbmod.get_conn()
    ensure_players_tables(conn)

    resolved_any = False
    for seat, ocr_name in (("p2", p2_name), ("p3", p3_name)):
        if ocr_name:
            canonical, tipo = resolve_name(conn, ocr_name, gamecode=gamecode)
            if canonical:
                out[seat] = {"name": canonical, "tipo": tipo}
                if canonical != ocr_name:
                    out[seat]["ocr_alias"] = ocr_name
                resolved_any = True

    conn.commit()
    out["ok"] = resolved_any
    if not out["ok"]:
        out["errors"].append("no_valid_names")
    return out


if __name__ == "__main__":
    import sys

    image_path = None
    if "--image" in sys.argv:
        try:
            image_path = sys.argv[sys.argv.index("--image") + 1]
        except Exception:
            image_path = None

    res = classify_villano(image_path) if image_path else {"ok": False, "errors": ["no_image"]}
    print(
        json.dumps(
            {
                "ok": res.get("ok", False),
                "p2": res.get("p2", {}),
                "p3": res.get("p3", {}),
                "created": res.get("created", []),
                "errors": res.get("errors", []),
            },
            ensure_ascii=False,
        )
    )
