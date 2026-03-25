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
    """
    DB path resolution order:
      1) env override via get_db_path_from_env(cfg) (e.g. MUSICA_DB_PATH in tests)
      2) project ./data/<default_filename>
    """
    cfg = cfg or DBConfig()

    env_path = get_db_path_from_env(cfg)
    if env_path:
        # #region agent log
        try:
            import json as _json, time as _time

            with open("debug-65a7d6.log", "a", encoding="utf-8") as _f:
                _f.write(
                    _json.dumps(
                        {
                            "sessionId": "65a7d6",
                            "runId": "repro",
                            "hypothesisId": "H1",
                            "location": "modules/db/paths.py:get_db_path:env",
                            "message": "Resolved DB path from env override",
                            "data": {"env_path": str(env_path)},
                            "timestamp": int(_time.time() * 1000),
                        }
                    )
                    + "\n"
                )
        except Exception:
            pass
        # #endregion agent log
        return env_path

    resolved = os.path.join(data_dir(), cfg.default_filename)
    # #region agent log
    try:
        import json as _json, time as _time

        with open("debug-65a7d6.log", "a", encoding="utf-8") as _f:
            _f.write(
                _json.dumps(
                    {
                        "sessionId": "65a7d6",
                        "runId": "repro",
                        "hypothesisId": "H1",
                        "location": "modules/db/paths.py:get_db_path:default",
                        "message": "Resolved DB path from project data dir",
                        "data": {"resolved": str(resolved), "default_filename": str(cfg.default_filename)},
                        "timestamp": int(_time.time() * 1000),
                    }
                )
                + "\n"
            )
    except Exception:
        pass
    # #endregion agent log
    return resolved
