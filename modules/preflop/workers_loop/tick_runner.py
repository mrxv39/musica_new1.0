# C:\Users\Usuario\Desktop\proyectos\poker_boss\modules\preflop\workers_loop\tick_runner.py
from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from typing import Any, Dict, Optional, TextIO

from .config import AREAS
from .worker_mesa import run_worker_mesa_once


def run_one_tick(
    *,
    dirs: Any,
    ts: str,
    interval_ms: int,
    verbose: bool,
    fp: TextIO,
    fixed_input: Optional[str],
    last_sig_by_mesa: Dict[int, Optional[str]],
    dbg: bool,
    worker_preflop_mod: Any,
    dbmod: Any,
    MatchInput: Any,
    select_move: Any,
    extract_modules_fn: Any,
    build_ocr_safe_fn: Any,
    compute_strategy_safe_fn: Any,
    mesa_index: Optional[int] = None,
) -> None:
    _ = worker_preflop_mod

    if mesa_index is not None and 0 <= mesa_index < len(AREAS):
        areas_to_run = [AREAS[mesa_index]]
    else:
        areas_to_run = AREAS

    max_workers = max(1, len(areas_to_run))
    futures: list[tuple[int, Any]] = []

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        for area in areas_to_run:
            mesa = int(area["mesa"])
            future = executor.submit(
                run_worker_mesa_once,
                area=area,
                dirs=dirs,
                ts=ts,
                interval_ms=interval_ms,
                verbose=verbose,
                fp=fp,
                fixed_input=fixed_input,
                last_sig_by_mesa=last_sig_by_mesa,
                dbg=dbg,
                dbmod=dbmod,
                MatchInput=MatchInput,
                select_move=select_move,
                extract_modules_fn=extract_modules_fn,
                build_ocr_safe_fn=build_ocr_safe_fn,
                compute_strategy_safe_fn=compute_strategy_safe_fn,
            )
            futures.append((mesa, future))

        for mesa, future in futures:
            try:
                future.result()
            except Exception as e:
                fp.write(f"[mesa {mesa}] TICK_WORKER_ERROR: {type(e).__name__}:{e}\n")
                fp.flush()

