from __future__ import annotations

"""
Reprocess a single time-spots folder against poker_boss.db.

Examples:
    python -m scripts.reprocess_time_spots_folder --folder "data/spots_raw/time_spots/20260312" --dry-run
    python -m scripts.reprocess_time_spots_folder --folder "data/spots_raw/time_spots/20260312" --yes
"""

import argparse
import json
import os
import sqlite3
import sys
from contextlib import contextmanager
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Iterable, Iterator, List, Optional

from modules.db.migrate import init_db
from modules.db.paths import get_db_path
from modules.preflop.link_hands_obs_to_real import link_hands_obs_to_real
from modules.workers.worker_loop import process_one_image
from modules.workers.worker_loop_types import LoopConfig
from modules.workers.worker_utils import get_file_fingerprint

IMAGE_EXTENSIONS = {".png", ".bmp", ".jpg", ".jpeg", ".webp"}
DEFAULT_FOLDER = Path("data/spots_raw/time_spots/20260312")


@dataclass
class FolderRows:
    obs_ids: List[int]
    link_ids: List[int]
    capture_ids: List[int]


def _reset_db_module_cache() -> None:
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
    _reset_db_module_cache()
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
        _reset_db_module_cache()


def _normalize_db_path(raw_path: str) -> str:
    return os.path.abspath(os.path.normpath(raw_path))


def _normalize_path_for_match(raw_path: str) -> str:
    return _normalize_db_path(raw_path).replace("/", "\\").rstrip("\\")


def _path_match_clause(column: str) -> str:
    normalized = f"REPLACE(COALESCE({column}, ''), '/', '\\')"
    return f"({normalized} = ? OR {normalized} LIKE ?)"


def _path_match_params(folder_path: str) -> tuple[str, str]:
    normalized = _normalize_path_for_match(folder_path)
    return normalized, normalized + "\\%"


def _collect_rows_for_folder(conn: sqlite3.Connection, folder_path: str) -> FolderRows:
    params = _path_match_params(folder_path)
    obs_rows = conn.execute(
        f"SELECT obs_id FROM spots WHERE {_path_match_clause('frame_ref')} ORDER BY obs_id",
        params,
    ).fetchall()
    obs_ids = [int(row["obs_id"]) for row in obs_rows]

    link_ids: List[int] = []  # legacy, kept for FolderRows compat

    capture_rows = conn.execute(
        (
            "SELECT capture_id FROM workers_captures WHERE "
            f"{_path_match_clause('image_path')} OR {_path_match_clause('final_image_path')} "
            "ORDER BY capture_id"
        ),
        params + params,
    ).fetchall()
    capture_ids = [int(row["capture_id"]) for row in capture_rows]

    return FolderRows(obs_ids=obs_ids, link_ids=link_ids, capture_ids=capture_ids)


def _delete_rows_for_folder(conn: sqlite3.Connection, rows: FolderRows) -> Dict[str, int]:
    deleted_obs = 0
    deleted_captures = 0

    if rows.obs_ids:
        placeholders = ",".join("?" for _ in rows.obs_ids)
        cur = conn.execute(f"DELETE FROM spots WHERE obs_id IN ({placeholders})", tuple(rows.obs_ids))
        deleted_obs = cur.rowcount if cur.rowcount != -1 else len(rows.obs_ids)

    if rows.capture_ids:
        placeholders = ",".join("?" for _ in rows.capture_ids)
        cur = conn.execute(
            f"DELETE FROM workers_captures WHERE capture_id IN ({placeholders})",
            tuple(rows.capture_ids),
        )
        deleted_captures = cur.rowcount if cur.rowcount != -1 else len(rows.capture_ids)

    return {
        "deleted_obs": deleted_obs,
        "deleted_workers_captures": deleted_captures,
    }


def _iter_images(folder_path: str) -> List[str]:
    root = Path(folder_path)
    images = [
        str(path.resolve())
        for path in root.rglob("*")
        if path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS
    ]
    images.sort(key=lambda path: path.lower())
    return images


def _build_cfg() -> LoopConfig:
    return LoopConfig(
        worker_id=9001,
        interval_ms=0,
        image_path=None,
        images_dir=None,
        loop_dir=False,
        region=None,
        max_ticks=1,
        print_every_tick=False,
        persist_without_stack=False,
    )


def _process_image(
    *,
    image_path: str,
    dbmod: Any,
    run_ocr_fn: Any,
    MatchInput: Any,
    select_move: Any,
    last_hand_sig: Optional[str],
) -> tuple[Dict[str, Any], Optional[str]]:
    return process_one_image(
        cfg=_build_cfg(),
        mode="single_image",
        img_path=image_path,
        image_ref=image_path,
        dbmod=dbmod,
        run_ocr_fn=run_ocr_fn,
        MatchInput=MatchInput,
        select_move=select_move,
        last_hand_sig=last_hand_sig,
        persist_to_db=True,
    )


def _find_latest_obs_id_for_frame(conn: sqlite3.Connection, image_path: str) -> Optional[int]:
    row = conn.execute(
        "SELECT obs_id FROM spots WHERE frame_ref = ? ORDER BY obs_id DESC LIMIT 1",
        (image_path,),
    ).fetchone()
    return int(row["obs_id"]) if row else None


def _insert_worker_capture_for_image(dbmod: Any, image_path: str) -> Optional[int]:
    image_size_bytes = os.path.getsize(image_path)
    image_fingerprint = get_file_fingerprint(image_path)
    return dbmod.insert_worker_capture(
        mesa=0,
        image_path=image_path,
        image_fingerprint=image_fingerprint,
        image_size_bytes=image_size_bytes,
        status="reprocessing",
        reason="reprocess_time_spots_folder",
    )


def _update_worker_capture_from_result(dbmod: Any, capture_id: Optional[int], image_path: str, out: Dict[str, Any]) -> None:
    if not capture_id:
        return

    ocr_payload = out.get("ocr", {})
    ocr_ok = bool(isinstance(ocr_payload, dict) and ocr_payload.get("ok"))
    dbmod.update_worker_capture_ocr(
        capture_id=capture_id,
        ocr_ok=ocr_ok,
        ocr_json=json.dumps(ocr_payload, ensure_ascii=False),
    )

    reason = "persisted" if out.get("persisted") else (out.get("dedupe_reason") or "not_persisted")
    dbmod.update_worker_capture_route(
        capture_id=capture_id,
        final_image_path=image_path,
        status="processed" if ocr_ok else "processed_with_ocr_errors",
        reason=str(reason),
    )


def _prompt_confirmation(folder_path: str, db_path: str, counts: FolderRows, image_count: int) -> bool:
    print(
        f"About to delete {len(counts.obs_ids)} spots and "
        f"{len(counts.capture_ids)} workers_captures rows for folder:\n{folder_path}\n"
        f"DB: {db_path}\n"
        f"Then it will reprocess {image_count} images.\n"
        "Type 'yes' to continue:",
        file=sys.stderr,
    )
    return input().strip().lower() == "yes"


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Reset and reprocess one time_spots folder into poker_boss.db")
    parser.add_argument("--db-path", default="", help="SQLite DB path. Defaults to get_db_path().")
    parser.add_argument("--folder", default=str(DEFAULT_FOLDER), help="Folder with images to reprocess.")
    parser.add_argument("--dry-run", action="store_true", help="Count affected rows and images without changing data.")
    parser.add_argument("--yes", action="store_true", help="Skip confirmation prompt.")
    return parser.parse_args()


def main() -> int:
    args = _parse_args()
    db_path = _normalize_db_path(args.db_path or get_db_path())
    folder_path = _normalize_db_path(args.folder)

    result: Dict[str, Any] = {
        "folder": folder_path,
        "deleted_obs": 0,
        "deleted_links": 0,
        "deleted_workers_captures": 0,
        "processed_images": 0,
        "linked_obs": 0,
        "ok": False,
        "errors": [],
    }

    if not os.path.isdir(folder_path):
        result["errors"].append({"path": folder_path, "error": "folder_not_found"})
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 1

    image_paths = _iter_images(folder_path)
    result["images_found"] = len(image_paths)
    result["db_path"] = db_path

    with _db_env(db_path):
        init_db()

        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        try:
            rows = _collect_rows_for_folder(conn, folder_path)
            result["matched_obs"] = len(rows.obs_ids)
            result["matched_links"] = len(rows.link_ids)
            result["matched_workers_captures"] = len(rows.capture_ids)

            if args.dry_run:
                print(json.dumps({**result, "ok": True, "dry_run": True}, ensure_ascii=False, indent=2))
                return 0

            if not args.yes and not _prompt_confirmation(folder_path, db_path, rows, len(image_paths)):
                result["errors"].append({"path": folder_path, "error": "confirmation_rejected"})
                print(json.dumps(result, ensure_ascii=False, indent=2))
                return 1

            deleted = _delete_rows_for_folder(conn, rows)
            conn.commit()
            result.update(deleted)

            import modules.db.db as dbmod
            from modules.ocr.ocr import run_ocr
            from modules.strategy.substrategy_selector import MatchInput, select_move

            last_hand_sig: Optional[str] = None
            new_obs_ids: List[int] = []

            for image_path in image_paths:
                capture_id = None
                try:
                    capture_id = _insert_worker_capture_for_image(dbmod, image_path)
                    out, last_hand_sig = _process_image(
                        image_path=image_path,
                        dbmod=dbmod,
                        run_ocr_fn=run_ocr,
                        MatchInput=MatchInput,
                        select_move=select_move,
                        last_hand_sig=last_hand_sig,
                    )
                    _update_worker_capture_from_result(dbmod, capture_id, image_path, out)

                    if out.get("persisted"):
                        obs_id = _find_latest_obs_id_for_frame(conn, image_path)
                        if obs_id is not None:
                            new_obs_ids.append(obs_id)
                    result["processed_images"] += 1
                except Exception as exc:
                    if capture_id:
                        try:
                            dbmod.update_worker_capture_route(
                                capture_id=capture_id,
                                final_image_path=image_path,
                                status="error",
                                reason=f"{type(exc).__name__}: {exc}",
                            )
                        except Exception:
                            pass
                    result["processed_images"] += 1
                    result["errors"].append({"path": image_path, "error": f"{type(exc).__name__}: {exc}"})

            unique_obs_ids = sorted(set(new_obs_ids))
            link_result = link_hands_obs_to_real(db_path=db_path, obs_ids=unique_obs_ids)
            result["linked_obs"] = int(link_result.get("links_created", 0))
            result["linking"] = {
                "skipped": link_result.get("skipped", {}),
            }
            result["ok"] = len(result["errors"]) == 0
        finally:
            conn.close()

    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if result["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
