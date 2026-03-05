# tmp_import_spots_real.py
from __future__ import annotations

import json
import os
import sqlite3
import sys
from pathlib import Path
from typing import Any, Dict, List, Tuple


def _connect(db_path: str) -> sqlite3.Connection:
    con = sqlite3.connect(db_path)
    con.row_factory = sqlite3.Row
    return con


def _print_spots_real_schema(con: sqlite3.Connection) -> None:
    print("\n=== spots_real: sqlite_master CREATE SQL ===")
    row = con.execute(
        "SELECT sql FROM sqlite_master WHERE type='table' AND name='spots_real'"
    ).fetchone()
    print(row["sql"] if row and row["sql"] else "(not found)")

    print("\n=== spots_real: PRAGMA table_info ===")
    cols = con.execute("PRAGMA table_info(spots_real)").fetchall()
    # cid, name, type, notnull, dflt_value, pk
    for c in cols:
        print(
            f"- cid={c['cid']:<3} name={c['name']:<24} type={str(c['type']):<10} "
            f"notnull={c['notnull']} dflt={c['dflt_value']} pk={c['pk']}"
        )


def _default_for_type(col_type: str) -> Any:
    t = (col_type or "").upper()
    # Muy conservador: no queremos reventar NOT NULL.
    if "INT" in t:
        return 0
    if "REAL" in t or "FLOA" in t or "DOUB" in t or "NUM" in t or "DEC" in t:
        return 0
    if "BLOB" in t:
        return None
    # TEXT / VARCHAR / etc
    return ""


def _get_table_info(con: sqlite3.Connection) -> List[sqlite3.Row]:
    return con.execute("PRAGMA table_info(spots_real)").fetchall()


def _required_cols(table_info: List[sqlite3.Row]) -> List[sqlite3.Row]:
    # Requeridas: NOT NULL, sin default, y NO PK
    req: List[sqlite3.Row] = []
    for c in table_info:
        if int(c["pk"]) == 1:
            continue
        notnull = int(c["notnull"]) == 1
        has_default = c["dflt_value"] is not None
        if notnull and (not has_default):
            req.append(c)
    return req


def _existing_cols(table_info: List[sqlite3.Row]) -> List[str]:
    return [str(c["name"]) for c in table_info]


def _load_sidecar_json(path: Path) -> Dict[str, Any]:
    try:
        with path.open("r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"[WARN] JSON inválido: {path} -> {e}")
        return {}


def _coerce_value(value: Any, col_type: str) -> Any:
    if value is None:
        return None
    t = (col_type or "").upper()
    try:
        if "INT" in t:
            if isinstance(value, bool):
                return int(value)
            if isinstance(value, (int, float)):
                return int(value)
            if isinstance(value, str) and value.strip() != "":
                return int(float(value.strip()))
            return 0
        if "REAL" in t or "FLOA" in t or "DOUB" in t or "NUM" in t or "DEC" in t:
            if isinstance(value, bool):
                return float(int(value))
            if isinstance(value, (int, float)):
                return float(value)
            if isinstance(value, str) and value.strip() != "":
                return float(value.strip())
            return 0.0
        # TEXT-like
        if isinstance(value, (dict, list)):
            return json.dumps(value, ensure_ascii=False)
        return str(value)
    except Exception:
        # si falla coerción, devolvemos algo "seguro"
        return _default_for_type(col_type)


def _extract_region_str(sidecar: Dict[str, Any]) -> str:
    # region puede venir como dict/list/str; lo guardamos "serializado" si hace falta
    r = sidecar.get("region", "")
    if isinstance(r, str):
        return r
    if isinstance(r, (list, dict)):
        return json.dumps(r, ensure_ascii=False)
    return str(r) if r is not None else ""


def _build_row_from_sidecar(
    sidecar: Dict[str, Any],
    *,
    png_path: Path,
    existing_cols: List[str],
    table_info_map: Dict[str, sqlite3.Row],
) -> Dict[str, Any]:
    row: Dict[str, Any] = {}

    # Claves típicas que sabemos que existen en sidecar (según tu descripción):
    # - spot_hash
    # - saved_path
    # - region
    # (y "otros")
    # Sólo seteamos columnas que existan en spots_real.

    # Helper para setear si la columna existe
    def set_if_exists(col: str, value: Any) -> None:
        if col in existing_cols:
            col_type = str(table_info_map[col]["type"])
            row[col] = _coerce_value(value, col_type)

    # Mapeo directo por nombres idénticos si existen
    for k, v in sidecar.items():
        if k in existing_cols:
            set_if_exists(k, v)

    # Refuerzos “por si acaso” (nombres alternativos)
    if "spot_hash" in existing_cols:
        set_if_exists("spot_hash", sidecar.get("spot_hash", ""))

    # path del PNG por si en tabla se guarda como image_path / png_path / saved_path, etc.
    # Usamos el JSON si trae saved_path; si no, el path real detectado.
    sp = sidecar.get("saved_path") or sidecar.get("png_path") or str(png_path)
    for candidate in ("saved_path", "png_path", "image_path", "path"):
        if candidate in existing_cols:
            set_if_exists(candidate, sp)

    # region serializada
    for candidate in ("region", "capture_region", "roi"):
        if candidate in existing_cols:
            set_if_exists(candidate, _extract_region_str(sidecar))

    # timestamp si está en sidecar
    for candidate in ("created_at", "ts", "timestamp"):
        if candidate in existing_cols and candidate in sidecar:
            set_if_exists(candidate, sidecar.get(candidate))

    return row


def _fill_required_defaults(
    row: Dict[str, Any],
    *,
    required: List[sqlite3.Row],
) -> None:
    for c in required:
        name = str(c["name"])
        if name in row and row[name] is not None and row[name] != "":
            continue
        # si no viene, ponemos default por tipo (para cumplir NOT NULL)
        row[name] = _default_for_type(str(c["type"]))


def _insert_rows(con: sqlite3.Connection, rows: List[Dict[str, Any]]) -> Tuple[int, int]:
    if not rows:
        return (0, 0)

    # Insertamos sólo con columnas presentes en cada row (pueden variar)
    inserted = 0
    skipped = 0

    for r in rows:
        cols = list(r.keys())
        if not cols:
            skipped += 1
            continue
        placeholders = ", ".join(["?"] * len(cols))
        col_list = ", ".join([f'"{c}"' for c in cols])

        sql = f'INSERT OR IGNORE INTO spots_real ({col_list}) VALUES ({placeholders})'
        vals = [r[c] for c in cols]
        cur = con.execute(sql, vals)
        if cur.rowcount == 1:
            inserted += 1
        else:
            skipped += 1

    con.commit()
    return (inserted, skipped)


def import_folder(db_path: str, folder: str) -> int:
    folder_path = Path(folder)
    if not folder_path.exists():
        print(f"[ERROR] Folder not found: {folder_path}")
        return 2

    con = _connect(db_path)
    try:
        _print_spots_real_schema(con)

        table_info = _get_table_info(con)
        existing_cols = _existing_cols(table_info)
        table_info_map = {str(c["name"]): c for c in table_info}
        required = _required_cols(table_info)

        print("\n=== Required cols (NOT NULL, no default, not PK) ===")
        if required:
            for c in required:
                print(f"- {c['name']} ({c['type']})")
        else:
            print("(none detected)")

        # localizar sidecars: .json junto a png con mismo stem
        json_files = sorted(folder_path.glob("*.json"))
        if not json_files:
            print(f"\n[WARN] No .json sidecars found in {folder_path}")
            # aun así: intentamos crear rows mínimas desde PNGs (fallback)
            pngs = sorted(folder_path.glob("*.png"))
            rows: List[Dict[str, Any]] = []
            for png in pngs:
                # row minimal: intentar meter path si hay columna, y spot_hash vacío
                sidecar = {"saved_path": str(png)}
                row = _build_row_from_sidecar(
                    sidecar, png_path=png, existing_cols=existing_cols, table_info_map=table_info_map
                )
                _fill_required_defaults(row, required=required)
                rows.append(row)
            ins, skip = _insert_rows(con, rows)
            print(f"\n=== Import result (fallback PNG-only) ===\ninserted={ins} skipped={skip}")
            return 0

        rows: List[Dict[str, Any]] = []
        for jf in json_files:
            sidecar = _load_sidecar_json(jf)

            # asociar png: mismo stem, si existe; si no, usar saved_path del json
            png = folder_path / (jf.stem + ".png")
            if not png.exists():
                sp = sidecar.get("saved_path")
                if sp:
                    png = Path(str(sp))
                # si sigue sin existir, no pasa nada: importamos igual el json
            row = _build_row_from_sidecar(
                sidecar,
                png_path=png,
                existing_cols=existing_cols,
                table_info_map=table_info_map,
            )
            _fill_required_defaults(row, required=required)
            rows.append(row)

        before = con.execute("SELECT COUNT(*) AS n FROM spots_real").fetchone()["n"]
        ins, skip = _insert_rows(con, rows)
        after = con.execute("SELECT COUNT(*) AS n FROM spots_real").fetchone()["n"]

        print("\n=== Import result ===")
        print(f"json_sidecars={len(json_files)}")
        print(f"before={before} after={after}")
        print(f"inserted={ins} skipped={skip}")

        # sanity: muestra 5 filas
        print("\n=== Sample rows (limit 5) ===")
        sample = con.execute("SELECT * FROM spots_real LIMIT 5").fetchall()
        for i, r in enumerate(sample, 1):
            d = dict(r)
            keys = list(d.keys())
            show = {k: d[k] for k in keys[: min(10, len(keys))]}
            print(f"[{i}] {show}")

        return 0
    finally:
        con.close()


def main() -> int:
    if len(sys.argv) != 3:
        print("Usage: python tmp_import_spots_real.py <db_path> <folder>")
        return 2
    return import_folder(sys.argv[1], sys.argv[2])


if __name__ == "__main__":
    raise SystemExit(main())
