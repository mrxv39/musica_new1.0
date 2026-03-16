# C:\Users\Usuario\Desktop\proyectos\poker_boss\modules\preflop\workers_loop\loop_runner.py
from __future__ import annotations

import os
import time
from datetime import datetime
from typing import Any, Dict, Optional, TextIO

from .config import AREAS, DEFAULT_FALLBACK_SE_ENABLED, PROJECT_ROOT
from .env_flags import debug_enabled, enable_fallback_env, pytest_fixed_input
from .fs_utils import ensure_dirs, log
from .tick_runner import run_one_tick
from .test_compat import build_ocr_safe, compute_strategy_safe, extract_modules


def _debug_enabled() -> bool:
    return debug_enabled()


def _pytest_fixed_input(base_dir: str) -> Optional[str]:
    return pytest_fixed_input(base_dir)


def _env_text(name: str) -> str:
    return os.environ.get(name, "").strip()


def _env_int(name: str, default: int) -> int:
    try:
        value = int(_env_text(name) or str(default))
    except Exception:
        return default
    return value if value > 0 else default


def _run_sync_tasks(
    *,
    tick_n: int,
    db_path: str,
    xml_dir: str,
    hero: str,
    sync_every_ticks: int,
    fp: TextIO,
    import_xml_folder_fn: Any,
    link_hands_obs_to_real_fn: Any,
    link_obs_to_spots_fn: Any,
) -> None:
    if xml_dir and hero and (tick_n % sync_every_ticks == 0):
        try:
            result = import_xml_folder_fn(
                folder=xml_dir,
                db_path=db_path,
                room="championpoker",
                hero=hero,
                recursive=False,
                verbose=False,
            )
            log(fp, f"SYNC_IMPORT_XML tick={tick_n} result={result}")
        except Exception as e:
            log(fp, f"SYNC_IMPORT_XML_ERROR tick={tick_n} err={type(e).__name__}:{e}")

    try:
        result = link_hands_obs_to_real_fn(db_path=db_path)
        links_created = None
        if isinstance(result, dict):
            links_created = result.get("links_created")
        log(fp, f"SYNC_LINK_HANDS_OBS_TO_REAL tick={tick_n} links_created={links_created}")
    except Exception as e:
        log(fp, f"SYNC_LINK_HANDS_OBS_TO_REAL_ERROR tick={tick_n} err={type(e).__name__}:{e}")

    try:
        result = link_obs_to_spots_fn(db_path=db_path, verbose=False)
        linked = None
        if isinstance(result, dict):
            linked = result.get("linked")
        log(fp, f"SYNC_LINK_SPOTS_XML_REAL tick={tick_n} linked={linked}")
    except Exception as e:
        log(fp, f"SYNC_LINK_SPOTS_XML_REAL_ERROR tick={tick_n} err={type(e).__name__}:{e}")


def run_loop(
    out_dir: str,
    interval_ms: int,
    verbose: bool,
    fp: TextIO,
    max_ticks: Optional[int] = None,
) -> None:
    base_dir = os.path.abspath(out_dir)
    dirs = ensure_dirs(base_dir)

    enable_fallback_env(DEFAULT_FALLBACK_SE_ENABLED)

    log(
        fp,
        f"START run_workers_loop base_dir={base_dir} interval_ms={interval_ms} verbose={verbose} max_ticks={max_ticks}",
    )
    log(fp, f"PROJECT_ROOT={PROJECT_ROOT}")
    log(fp, f"POKER_BOSS_FALLBACK_SE={os.environ.get('POKER_BOSS_FALLBACK_SE','')}")
    db_path = _env_text("POKER_BOSS_DB_PATH") or _env_text("MUSICA_DB_PATH")
    xml_dir = _env_text("POKER_BOSS_XML_DIR")
    hero = _env_text("POKER_BOSS_HERO")
    sync_every_ticks = _env_int("POKER_BOSS_SYNC_EVERY_TICKS", 10)
    mesa_index_raw = _env_text("POKER_BOSS_MESA_INDEX")
    mesa_index: Optional[int] = None
    if mesa_index_raw != "":
        try:
            mesa_index = int(mesa_index_raw)
            if mesa_index < 0 or mesa_index >= len(AREAS):
                mesa_index = None
        except (ValueError, TypeError):
            mesa_index = None
    log(fp, f"POKER_BOSS_DB_PATH={db_path}")
    log(fp, f"POKER_BOSS_XML_DIR={xml_dir}")
    log(fp, f"POKER_BOSS_HERO={hero}")
    log(fp, f"POKER_BOSS_MESA_INDEX={mesa_index!r}")
    log(fp, f"POKER_BOSS_SYNC_EVERY_TICKS={sync_every_ticks}")

    import modules.workers.worker_preflop as worker_preflop_mod
    from modules.db import db as dbmod
    from modules.importers.championpoker_xml_importer import import_xml_folder
    from modules.preflop.link_hands_obs_to_real import link_hands_obs_to_real
    from modules.preflop.link_hands_obs_to_spots_xml_real import link_obs_to_spots

    try:
        from modules.strategy.substrategy_selector import MatchInput, select_move
    except Exception:
        MatchInput = None
        select_move = None

    dbg = _debug_enabled()
    last_sig_by_mesa: Dict[int, Optional[str]] = {}
    fixed_input = _pytest_fixed_input(base_dir)

    ticks_done = 0

    try:
        while True:
            if max_ticks is not None and ticks_done >= max_ticks:
                break

            ts = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
            tick_n = ticks_done + 1

            log(fp, f"TICK_START n={tick_n} ts={ts}")

            try:
                run_one_tick(
                    dirs=dirs,
                    ts=ts,
                    interval_ms=interval_ms,
                    verbose=verbose,
                    fp=fp,
                    fixed_input=fixed_input,
                    last_sig_by_mesa=last_sig_by_mesa,
                    dbg=dbg,
                    worker_preflop_mod=worker_preflop_mod,
                    dbmod=dbmod,
                    MatchInput=MatchInput,
                    select_move=select_move,
                    extract_modules_fn=extract_modules,
                    build_ocr_safe_fn=build_ocr_safe,
                    compute_strategy_safe_fn=compute_strategy_safe,
                    mesa_index=mesa_index,
                )
            except Exception as e:
                log(fp, f"TICK_ERROR n={tick_n} err={type(e).__name__}:{e}")

            if db_path:
                _run_sync_tasks(
                    tick_n=tick_n,
                    db_path=db_path,
                    xml_dir=xml_dir,
                    hero=hero,
                    sync_every_ticks=sync_every_ticks,
                    fp=fp,
                    import_xml_folder_fn=import_xml_folder,
                    link_hands_obs_to_real_fn=link_hands_obs_to_real,
                    link_obs_to_spots_fn=link_obs_to_spots,
                )
            else:
                log(fp, f"SYNC_SKIPPED tick={tick_n} reason=missing_db_path")

            log(fp, f"TICK_END n={tick_n}")

            ticks_done += 1

            if max_ticks is not None and ticks_done >= max_ticks:
                break

            time.sleep(max(150, interval_ms) / 1000.0)

    except KeyboardInterrupt:
        log(fp, f"STOP requested by user ticks_done={ticks_done}")

    log(fp, f"END run_workers_loop ticks_done={ticks_done}")
