from __future__ import annotations

import argparse
import json
import sqlite3
import time
from typing import Any, Dict, List, Optional, Tuple

RANK_ORDER = "23456789TJQKA"
RANK_VALUE = {r: i for i, r in enumerate(RANK_ORDER)}


def _norm_rank(x: str) -> str:
    x = (x or "").strip().upper()
    if x == "10":
        return "T"
    return x[:1]


def _parse_card_token(tok: str) -> Optional[Tuple[str, str]]:
    t = (tok or "").strip().upper()
    if not t:
        return None

    suits = set("CDHS")
    ranks = set("23456789TJQKA")

    # suit-first, e.g. DA / D10 / SQ
    if len(t) >= 2 and t[0] in suits:
        suit = t[0]
        rank = _norm_rank(t[1:])
        if rank in ranks:
            return rank, suit

    # rank-first, e.g. AS / 10D
    if len(t) >= 2 and t[-1] in suits:
        suit = t[-1]
        rank = _norm_rank(t[:-1])
        if rank in ranks:
            return rank, suit

    return None


def _split_cards(raw: str) -> List[str]:
    s = (raw or "").strip()
    if not s:
        return []

    if " " in s:
        return [x for x in s.split() if x]

    # OCR style: AsQc / 2d4s
    if len(s) == 4:
        return [s[:2], s[2:]]
    if len(s) == 6:
        return [s[:3], s[3:]]

    return [s]


def cards_to_hand_class(raw: str) -> str:
    toks = _split_cards(raw)
    if len(toks) != 2:
        return ""

    c1 = _parse_card_token(toks[0])
    c2 = _parse_card_token(toks[1])
    if not c1 or not c2:
        return ""

    r1, s1 = c1
    r2, s2 = c2

    if RANK_VALUE[r1] < RANK_VALUE[r2]:
        r1, r2 = r2, r1
        s1, s2 = s2, s1

    if r1 == r2:
        return f"{r1}{r2}"

    suited = "s" if s1 == s2 else "o"
    return f"{r1}{r2}{suited}"


def _safe_json(s: str) -> Dict[str, Any]:
    try:
        v = json.loads(s or "{}")
        return v if isinstance(v, dict) else {}
    except Exception:
        return {}


def _obs_players_count(ocr_json: str) -> Optional[int]:
    data = _safe_json(ocr_json)
    try:
        return int(data.get("ocr", {}).get("table_state", {}).get("players"))
    except Exception:
        return None


def ensure_schema(con: sqlite3.Connection) -> None:
    con.execute("""
    CREATE TABLE IF NOT EXISTS spot_links (
      link_id INTEGER PRIMARY KEY AUTOINCREMENT,
      obs_id INTEGER NOT NULL,
      spot_id INTEGER NOT NULL,
      match_score REAL,
      match_method TEXT,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (obs_id) REFERENCES spots(obs_id),
      FOREIGN KEY (spot_id) REFERENCES spots_xml_real(spot_id)
    )
    """)
    con.execute("""
    CREATE UNIQUE INDEX IF NOT EXISTS idx_spot_links_obs_id
    ON spot_links(obs_id)
    """)
    con.execute("""
    CREATE INDEX IF NOT EXISTS idx_spot_links_spot_id
    ON spot_links(spot_id)
    """)
    con.commit()


def load_obs(con: sqlite3.Connection) -> List[Dict[str, Any]]:
    cur = con.cursor()
    rows = cur.execute("""
    SELECT
      spot_id,
      table_id,
      detected_at_ms,
      mano_raw,
      hand_class,
      preflop_ok,
      ocr_json,
      p2bet,
      p3bet,
      frame_ref
    FROM spots
    ORDER BY detected_at_ms ASC, spot_id ASC
    """).fetchall()

    out: List[Dict[str, Any]] = []
    for r in rows:
        hc = r[4] or cards_to_hand_class(r[3] or "")
        out.append({
            "obs_id": int(r[0]),
            "obs_id": int(r[0]),  # alias for backward compat with spot_links.obs_id
            "table_id": r[1],
            "detected_at_ms": int(r[2] or 0),
            "mano_raw": r[3] or "",
            "hand_class": hc or "",
            "preflop_ok": int(r[5] or 0),
            "ocr_json": r[6] or "{}",
            "players_count": _obs_players_count(r[6] or "{}"),
            "p2bet": r[7],
            "p3bet": r[8],
            "frame_ref": r[9] or "",
        })
    return out


def load_spots(con: sqlite3.Connection) -> List[Dict[str, Any]]:
    cur = con.cursor()
    rows = cur.execute("""
    SELECT
      spot_id,
      hand_id,
      gamecode,
      hero_name,
      street,
      spot_index,
      action_index,
      hero_cards,
      players_count,
      spot_kind
    FROM spots_xml_real
    WHERE lower(street) = 'preflop'
    ORDER BY spot_id ASC
    """).fetchall()

    out: List[Dict[str, Any]] = []
    for r in rows:
        out.append({
            "obs_id": int(r[0]),
            "hand_id": int(r[1]),
            "gamecode": r[2] or "",
            "hero_name": r[3] or "",
            "street": r[4] or "",
            "spot_index": int(r[5] or 0),
            "action_index": int(r[6] or 0),
            "hero_cards": r[7] or "",
            "hand_class": cards_to_hand_class(r[7] or ""),
            "players_count": r[8],
            "spot_kind": r[9] or "",
        })
    return out


def score_pair(obs: Dict[str, Any], spot: Dict[str, Any]) -> float:
    score = 0.0

    if not obs["hand_class"] or not spot["hand_class"]:
        return -1.0

    if obs["hand_class"] != spot["hand_class"]:
        return -1.0

    score += 100.0

    if obs["preflop_ok"] == 1:
        score += 5.0

    if obs["players_count"] is not None and spot["players_count"] is not None:
        if int(obs["players_count"]) == int(spot["players_count"]):
            score += 10.0

    # bonus leve para primeros spots
    if int(spot["spot_index"]) == 1:
        score += 1.0

    return score


def link_obs_to_spots(db_path: str, verbose: bool = True) -> Dict[str, Any]:
    con = sqlite3.connect(db_path)
    try:
        ensure_schema(con)
        cur = con.cursor()

        obs_rows = load_obs(con)
        spot_rows = load_spots(con)

        cur.execute("DELETE FROM spot_links")

        used_spot_ids = set()
        links: List[Tuple[int, int, float, str, int]] = []

        for obs in obs_rows:
            best = None
            best_score = -1.0

            for spot in spot_rows:
                if spot["obs_id"] in used_spot_ids:
                    continue

                s = score_pair(obs, spot)
                if s < 0:
                    continue

                if s > best_score:
                    best_score = s
                    best = spot

            if best is None:
                continue

            used_spot_ids.add(best["obs_id"])
            links.append((
                int(obs["obs_id"]),
                int(best["obs_id"]),
                float(best_score),
                "v1_hand_class_players_seq",
                int(time.time() * 1000),
            ))

        cur.executemany("""
        INSERT INTO spot_links(obs_id, spot_id, match_score, match_method, created_at)
        VALUES (?, ?, ?, ?, ?)
        """, links)

        con.commit()

        res = {
            "ok": True,
            "obs_total": len(obs_rows),
            "spots_total": len(spot_rows),
            "linked": len(links),
            "unlinked_obs": max(0, len(obs_rows) - len(links)),
            "unused_spots": max(0, len(spot_rows) - len(links)),
        }

        if verbose:
            print(json.dumps(res, ensure_ascii=False, indent=2))

        return res
    finally:
        con.close()


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", required=True)
    ap.add_argument("--quiet", action="store_true")
    args = ap.parse_args()

    link_obs_to_spots(args.db, verbose=not args.quiet)


if __name__ == "__main__":
    main()
