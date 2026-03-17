# modules/db/repo_spots_capture.py
from __future__ import annotations

import json
from typing import Any, Dict, Optional

from .conn import connect
from .migrate import init_db


def insert_spot_capture(
    *,
    mesa: int,
    image_path: str,
    ts: str,
    stacks_json: str = "{}",
    bets_json: str = "{}",
    names_json: str = "{}",
    tipo_p2: str = "",
    tipo_p3: str = "",
    raw_json: str = "{}",
    time_sec: Optional[float] = None,
    spot_fingerprint: str = "",
    strategy_id: Optional[int] = None,
) -> Optional[int]:
    """Inserta un spot preflop detectado por captura (time + mano + noboard ok).

    Si ya existe un spot con el mismo spot_fingerprint creado en los últimos
    10 segundos, no inserta una fila nueva y devuelve el id existente.
    """
    init_db()
    with connect() as conn:
        cur = conn.cursor()
        if spot_fingerprint:
            # Heurística de deduplicación: mismo fingerprint (mesa + P1 stack) y
            # fila creada en los últimos 10 segundos.
            # #region agent log
            try:
                import json as _json, time as _time

                with open("debug-65a7d6.log", "a", encoding="utf-8") as _f:
                    _f.write(
                        _json.dumps(
                            {
                                "sessionId": "65a7d6",
                                "runId": "pre-fix",
                                "hypothesisId": "H2",
                                "location": "repo_spots_capture.insert_spot_capture:before_select",
                                "message": "Checking recent spot by fingerprint",
                                "data": {
                                    "mesa": int(mesa),
                                    "spot_fingerprint": spot_fingerprint,
                                },
                                "timestamp": int(_time.time() * 1000),
                            }
                        )
                        + "\n"
                    )
            except Exception:
                pass
            # #endregion agent log

            cur.execute(
                """
                SELECT id, ts, created_at
                FROM spots
                WHERE spot_fingerprint = ?
                  AND created_at >= datetime('now', '-10 seconds')
                LIMIT 1
                """,
                (spot_fingerprint,),
            )
            row = cur.fetchone()
            if row and row[0]:
                # #region agent log
                try:
                    import json as _json, time as _time

                    with open("debug-65a7d6.log", "a", encoding="utf-8") as _f:
                        _f.write(
                            _json.dumps(
                                {
                                    "sessionId": "65a7d6",
                                    "runId": "pre-fix",
                                    "hypothesisId": "H3",
                                    "location": "repo_spots_capture.insert_spot_capture:hit_existing",
                                    "message": "Existing recent spot found, reusing id",
                                    "data": {
                                        "existing_id": int(row[0]),
                                        "existing_ts": row[1],
                                        "existing_created_at": row[2],
                                        "mesa": int(mesa),
                                        "spot_fingerprint": spot_fingerprint,
                                    },
                                    "timestamp": int(_time.time() * 1000),
                                }
                            )
                            + "\n"
                        )
                except Exception:
                    pass
                # #endregion agent log
                return int(row[0])
        cur.execute(
            """
            INSERT INTO spots
            (mesa, image_path, ts, stacks_json, bets_json, names_json, tipo_p2, tipo_p3, raw_json, time, spot_fingerprint, strategy_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                int(mesa),
                image_path or "",
                ts or "",
                stacks_json or "{}",
                bets_json or "{}",
                names_json or "{}",
                tipo_p2 or "",
                tipo_p3 or "",
                raw_json or "{}",
                time_sec if time_sec is not None else None,
                spot_fingerprint or "",
                int(strategy_id) if strategy_id is not None else None,
            ),
        )
        # #region agent log
        try:
            import json as _json, time as _time

            with open("debug-65a7d6.log", "a", encoding="utf-8") as _f:
                _f.write(
                    _json.dumps(
                        {
                            "sessionId": "65a7d6",
                            "runId": "repro",
                            "hypothesisId": "H2",
                            "location": "repo_spots_capture.insert_spot_capture:after_insert",
                            "message": "Inserted spot row (pre-commit)",
                            "data": {
                                "mesa": int(mesa),
                                "ts": ts or "",
                                "spot_fingerprint": spot_fingerprint or "",
                                "strategy_id": int(strategy_id) if strategy_id is not None else None,
                                "lastrowid": int(cur.lastrowid) if cur.lastrowid else None,
                            },
                            "timestamp": int(_time.time() * 1000),
                        }
                    )
                    + "\n"
                )
        except Exception:
            pass
        # #endregion agent log
        conn.commit()
        # #region agent log
        try:
            import json as _json, time as _time

            with open("debug-65a7d6.log", "a", encoding="utf-8") as _f:
                _f.write(
                    _json.dumps(
                        {
                            "sessionId": "65a7d6",
                            "runId": "repro",
                            "hypothesisId": "H2",
                            "location": "repo_spots_capture.insert_spot_capture:after_commit",
                            "message": "Committed spot insert",
                            "data": {"lastrowid": int(cur.lastrowid) if cur.lastrowid else None},
                            "timestamp": int(_time.time() * 1000),
                        }
                    )
                    + "\n"
                )
        except Exception:
            pass
        # #endregion agent log
        return int(cur.lastrowid) if cur.lastrowid else None


def update_spot_strategy_id(*, spot_id: int, strategy_id: int) -> bool:
    init_db()
    with connect() as conn:
        cur = conn.cursor()
        cur.execute(
            "UPDATE spots SET strategy_id = ? WHERE id = ?",
            (int(strategy_id), int(spot_id)),
        )
        conn.commit()
        return cur.rowcount > 0


def _safe_json(obj: Any) -> str:
    try:
        return json.dumps(obj, ensure_ascii=False, default=str)
    except Exception:
        return "{}"


def insert_spot_capture_from_data(
    *,
    mesa: int,
    image_path: str,
    ts: str,
    stacks_result: Optional[Dict[str, Any]] = None,
    ocr: Optional[Dict[str, Any]] = None,
    preflop: Optional[Dict[str, Any]] = None,
    mano_result: Optional[Dict[str, Any]] = None,
    time_sec: Optional[float] = None,
    spot_fingerprint: str = "",
) -> Optional[int]:
    """Construye stacks/bets/names/tipo desde resultados del worker y llama a insert_spot_capture."""
    # Stacks: preflop modules no incluye "stacks"; usar ocr["stacks"] con claves p1/p2/p3
    stacks_obj: Dict[str, Any] = {}
    if isinstance(ocr, dict) and isinstance(ocr.get("stacks"), dict):
        s = ocr["stacks"]
        stacks_obj = {"p1": s.get("p1"), "p2": s.get("p2"), "p3": s.get("p3")}
    if not stacks_obj and isinstance(stacks_result, dict):
        stacks_obj = {"p1": stacks_result.get("p1"), "p2": stacks_result.get("p2"), "p3": stacks_result.get("p3")}
    stacks_json = _safe_json(stacks_obj) if stacks_obj else "{}"

    bets_json = "{}"
    names_json = "{}"
    tipo_p2 = ""
    tipo_p3 = ""
    if isinstance(ocr, dict):
        bets_json = _safe_json(ocr.get("bets")) if ocr.get("bets") else "{}"
        # Names: OCR devuelve p1_name/p2_name/p3_name; normalizar a p1/p2/p3 para la UI
        names = ocr.get("names") or ocr.get("players") or {}
        if isinstance(names, dict):
            names_obj = {
                "p1": str(names.get("p1_name") or "").strip(),
                "p2": str(names.get("p2_name") or "").strip(),
                "p3": str(names.get("p3_name") or "").strip(),
            }
            names_json = _safe_json(names_obj)
        # Tipo: villano devuelve {"p2": {"tipo": "..."}, "p3": {"tipo": "..."}}
        villano = ocr.get("villano") or {}
        if isinstance(villano, dict):
            tipo_p2 = str((villano.get("p2") or {}).get("tipo") or ocr.get("p2_tipo") or ocr.get("villano_p2_tipo") or "").strip()[:64]
            tipo_p3 = str((villano.get("p3") or {}).get("tipo") or ocr.get("p3_tipo") or ocr.get("villano_p3_tipo") or "").strip()[:64]
        else:
            tipo_p2 = str(ocr.get("p2_tipo") or ocr.get("villano_p2_tipo") or "")[:64]
            tipo_p3 = str(ocr.get("p3_tipo") or ocr.get("villano_p3_tipo") or "")[:64]
    raw = {
        "preflop": preflop,
        "mano_result": mano_result,
    }
    return insert_spot_capture(
        mesa=mesa,
        image_path=image_path,
        ts=ts,
        stacks_json=stacks_json,
        bets_json=bets_json,
        names_json=names_json,
        tipo_p2=tipo_p2,
        tipo_p3=tipo_p3,
        raw_json=_safe_json(raw),
        time_sec=time_sec,
        spot_fingerprint=spot_fingerprint,
    )
