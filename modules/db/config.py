# modules/db/config.py
from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class DBConfig:
    # Keep legacy env var for tests/backwards compatibility.
    env_var_legacy: str = "MUSICA_DB_PATH"
    # New preferred env var for this project.
    env_var: str = "POKER_BOSS_DB_PATH"
    # Default DB filename when env vars are not set.
    default_filename: str = "poker_boss.db"


def get_db_path_from_env(cfg: DBConfig) -> str | None:
    # New var first, then legacy.
    for key in (cfg.env_var, cfg.env_var_legacy):
        val = os.environ.get(key, "")
        if val and val.strip():
            return val.strip()
    return None
