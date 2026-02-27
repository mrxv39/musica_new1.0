# modules/db/paths.py
from __future__ import annotations

import os
from .config import DBConfig, get_db_path_from_env


def project_root() -> str:
    # modules/db -> project root
    return os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))


def data_dir(root: str | None = None) -> str:
    root = root or project_root()
    d = os.path.join(root, "data")
    os.makedirs(d, exist_ok=True)
    return d


def get_db_path(cfg: DBConfig | None = None) -> str:
    cfg = cfg or DBConfig()
    env_path = get_db_path_from_env(cfg)
    if env_path:
        return env_path

    return os.path.join(data_dir(), cfg.default_filename)
