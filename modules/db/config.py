# modules/db/config.py
from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class DBConfig:
    env_var: str = "POKER_BOSS_DB_PATH"
    # Default DB filename when env vars are not set.
    default_filename: str = "poker_boss.db"


def get_db_path_from_env(cfg: DBConfig) -> str | None:
    val = os.environ.get(cfg.env_var, "")
    if val and val.strip():
        return val.strip()
    return None
