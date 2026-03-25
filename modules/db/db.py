# modules/db/db.py
from __future__ import annotations

from .conn import get_conn
from .migrate import init_db
from .repo_obs import insert_obs, get_obs_by_fingerprint
from .repo_xml import upsert_xml_game, get_xml_by_gamecode, link_obs_to_game
from .repo_legacy import insert_hand, get_hand_by_fingerprint

__all__ = [
    "get_conn",
    "init_db",
    "insert_obs",
    "get_obs_by_fingerprint",
    "upsert_xml_game",
    "get_xml_by_gamecode",
    "link_obs_to_game",
    "insert_hand",
    "get_hand_by_fingerprint",
]
