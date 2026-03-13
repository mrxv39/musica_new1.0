from __future__ import annotations

import argparse
import json
import os
import sqlite3
from contextlib import contextmanager
from typing import Any, Dict, Iterator, Optional

from modules.db.migrate import init_db, now_ms
from modules.preflop.workers_loop.strategy_pipeline import compute_strategy_safe
from modules.preflop.workers_loop.strategy_utils import force_ok_on_default_fold

NO_MATCH_PHRASE = "Expected exactly 1 match, got 0"


def _default_db_path() -> str:
    from modules.db.paths import get_db_path

    return get_db_path()


def _strategy_error_text(strategy: Any) -> str:
    if not isinstance(strategy, dict):
        return ""
    candidates = [
        strategy.get("error"),
        strategy.get("err"),
        strategy.get("reason"),
        strategy.get("message"),
    ]
    for value in candidates:
        if isinstance(value, str) and value.strip():
            return value.strip()
    try:
        return json.dumps(strategy, ensure_ascii=False, default=str)
    except Exception:
        return str(strategy)


def _is_no_match_strategy(strategy: Any) -> bool:
    if not isinstance(strategy, dict):
        return False
    if strategy.get("ok") is True:
        return False
    return NO_MATCH_PHRASE in _strategy_error_text(strategy)


def _safe_json_loads(raw: str) -> Optional[Dict[str, Any]]:
    try:
        payload = json.loads(raw or "{}")
    except Exception:
        return None
    return payload if isinstance(payload, dict) else None


def _to_float(value: Any) -> Optional[float]:
    try:
        if value is None or value == "":
            return None
        return float(value)
    except Exception:
        return None


def _reset_db_cache() -> None:
    try:
        import modules.db.db as dbmod

        try:
            if getattr(dbmod, "_DB_CONN", None) is not None:
                dbmod._DB_CONN.close()
        except Exception:
            pass
        dbmod._DB_CONN = None
        dbmod._DB_PATH_ACTIVE = None
    except Exception:
        pass


@contextmanager
def _db_env(db_path: str) -> Iterator[None]:
    prev_db_path = os.environ.get("POKER_BOSS_DB_PATH")
    prev_legacy_db_path = os.environ.get("MUSICA_DB_PATH")
    os.environ["POKER_BOSS_DB_PATH"] = db_path
    os.environ["MUSICA_DB_PATH"] = db_path
    _reset_db_cache()
    try:
        yield
    finally:
        if prev_db_path is None:
            os.environ.pop("POKER_BOSS_DB_PATH", None)
        else:
            os.environ["POKER_BOSS_DB_PATH"] = prev_db_path

        if prev_legacy_db_path is None:
            os.environ.pop("MUSICA_DB_PATH", None)
        else:
            os.environ["MUSICA_DB_PATH"] = prev_legacy_db_path
        _reset_db_cache()


def _build_select_sql(limit: Optional[int], since_ms: Optional[int]) -> tuple[str, list[Any]]:
    sql = """
        SELECT obs_id, fingerprint, ocr_json, detected_at_ms
        FROM hands_obs
        WHERE ocr_json LIKE ?
    """
    params: list[Any] = [f"%{NO_MATCH_PHRASE}%"]
    if since_ms is not None:
        sql += " AND detected_at_ms >= ?"
        params.append(int(since_ms))
    sql += " ORDER BY detected_at_ms DESC, obs_id DESC"
    if limit is not None:
        sql += " LIMIT ?"
        params.append(int(limit))
    return sql, params


def _sync_workers_capture_payload(conn: sqlite3.Connection, fingerprint: str, ocr_json: str) -> int:
    cur = conn.execute(
        """
        UPDATE workers_captures
        SET ocr_json = ?, updated_at_ms = ?
        WHERE image_fingerprint = ?
        """,
        (ocr_json, now_ms(), fingerprint),
    )
    return int(cur.rowcount or 0)


def reprocess_no_strategy_obs(
    *,
    db_path: str,
    limit: Optional[int] = None,
    since_ms: Optional[int] = None,
    dry_run: bool = False,
) -> Dict[str, Any]:
    with _db_env(db_path):
        init_db()
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        try:
            sql, params = _build_select_sql(limit=limit, since_ms=since_ms)
            rows = conn.execute(sql, params).fetchall()

            stats: Dict[str, Any] = {
                "selected": 0,
                "updated": 0,
                "updated_ok": 0,
                "updated_still_not_ok": 0,
                "workers_captures_synced": 0,
                "skipped_missing_payload": 0,
                "skipped_not_no_match": 0,
                "obs_ids": [],
            }

            for row in rows:
                payload = _safe_json_loads(str(row["ocr_json"] or ""))
                if not payload:
                    stats["skipped_missing_payload"] += 1
                    continue

                strategy_before = payload.get("strategy")
                if not _is_no_match_strategy(strategy_before):
                    stats["skipped_not_no_match"] += 1
                    continue

                preflop = payload.get("preflop")
                mano_result = payload.get("mano")
                ocr = payload.get("ocr")
                if not isinstance(preflop, dict) or not isinstance(mano_result, dict) or not isinstance(ocr, dict):
                    stats["skipped_missing_payload"] += 1
                    continue

                stats["selected"] += 1
                stats["obs_ids"].append(int(row["obs_id"]))

                strategy, _err = compute_strategy_safe(preflop, mano_result, ocr)
                strategy = force_ok_on_default_fold(strategy)

                if dry_run:
                    if isinstance(strategy, dict) and strategy.get("ok") is True:
                        stats["updated_ok"] += 1
                    else:
                        stats["updated_still_not_ok"] += 1
                    continue

                payload["strategy"] = strategy if isinstance(strategy, dict) else {}
                new_ocr_json = json.dumps(payload, ensure_ascii=False, default=str)
                p1_se_bb = _to_float((strategy or {}).get("se_used") if isinstance(strategy, dict) else None)

                conn.execute(
                    "UPDATE hands_obs SET ocr_json = ?, p1_se_bb = ? WHERE obs_id = ?",
                    (new_ocr_json, p1_se_bb, int(row["obs_id"])),
                )
                stats["updated"] += 1
                if isinstance(strategy, dict) and strategy.get("ok") is True:
                    stats["updated_ok"] += 1
                else:
                    stats["updated_still_not_ok"] += 1

                stats["workers_captures_synced"] += _sync_workers_capture_payload(
                    conn,
                    str(row["fingerprint"] or ""),
                    new_ocr_json,
                )

            if not dry_run:
                conn.commit()

            return stats
        finally:
            conn.close()


def _build_arg_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="Recompute strategy only for OBS rows with no-match range errors.")
    p.add_argument("--db", default=_default_db_path(), help="SQLite DB path. Default: project data DB.")
    p.add_argument("--limit", type=int, default=None, help="Max OBS rows to reprocess.")
    p.add_argument("--since-ms", type=int, default=None, help="Only rows with detected_at_ms >= this timestamp.")
    p.add_argument("--dry-run", action="store_true", help="Show what would be reprocessed without writing.")
    return p


def main(argv: Optional[list[str]] = None) -> int:
    parser = _build_arg_parser()
    args = parser.parse_args(argv)
    stats = reprocess_no_strategy_obs(
        db_path=args.db,
        limit=args.limit,
        since_ms=args.since_ms,
        dry_run=bool(args.dry_run),
    )
    print(json.dumps(stats, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
