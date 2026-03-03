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

# --- test/runtime safety: reopen connection if DB path changes ---
_DB_CONN = None
_DB_PATH_ACTIVE = None

# --- test safety: ensure DB path changes reopen connection ---
_CONN_PATH = None
from .conn import get_conn as _get_conn_raw
from .migrate import init_db
from .repo_legacy import insert_hand, get_hand_by_fingerprint
from .repo_obs import insert_obs, get_obs_by_fingerprint
from .repo_xml import upsert_xml_game, get_xml_by_gamecode, link_obs_to_game


def get_conn():
    global _DB_CONN, _DB_PATH_ACTIVE
    path_now = get_db_path()
    if _DB_PATH_ACTIVE is None:
        _DB_PATH_ACTIVE = path_now
    # reopen connection if env DB path changed
    if _DB_PATH_ACTIVE != path_now:
        try:
            if _DB_CONN is not None:
                _DB_CONN.close()
        except Exception:
            pass
        _DB_CONN = None
        _DB_PATH_ACTIVE = path_now

    """
    API pública: devuelve conexión lista para usar.
    Aquí SÍ inicializamos schema (idempotente), para que tests y workers no fallen
    con 'no such table: ...'.

    OJO: conn.get_conn() debe ser RAW para evitar recursión/deadlock.
    """
    init_db()
    return _get_conn_raw()


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