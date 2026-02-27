# modules/db/db.py
"""
Refactor serio (split lógico):
- config/paths: resolución del path del DB (env + default).
- conn: conexión/contextmanager.
- migrate: init_db + migraciones ligeras + índices.
- repos: legacy / obs / xml.

Compatibilidad:
- Env var legacy: MUSICA_DB_PATH (tests antiguos).
- API pública sin cambios: init_db/get_conn/insert_hand/insert_obs/upsert_xml_game/...
"""
from __future__ import annotations

from .paths import get_db_path
from .conn import get_conn
from .migrate import init_db
from .repo_legacy import insert_hand, get_hand_by_fingerprint
from .repo_obs import insert_obs, get_obs_by_fingerprint
from .repo_xml import upsert_xml_game, get_xml_by_gamecode, link_obs_to_game

__all__ = [
    "get_db_path",
    "get_conn",
    "init_db",
    "insert_hand",
    "get_hand_by_fingerprint",
    "insert_obs",
    "get_obs_by_fingerprint",
    "upsert_xml_game",
    "get_xml_by_gamecode",
    "link_obs_to_game",
]
