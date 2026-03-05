# C:\Users\Usuario\Desktop\proyectos\poker_boss\modules\importers\championpoker_xml_inbox.py
from __future__ import annotations

import os
import shutil
from dataclasses import dataclass
from datetime import datetime
from glob import glob
from typing import List, Dict, Any

from modules.importers.championpoker_xml_importer import import_xml_folder


@dataclass
class ImportInboxResult:
    ok: bool
    inbox: str
    archive: str
    db_path: str
    room: str
    hero: str
    xml_found: int
    imported_files: int
    moved_files: int
    details: List[Dict[str, Any]]


def import_championpoker_inbox(
    *,
    inbox_dir: str,
    archive_root: str,
    db_path: str,
    room: str,
    hero: str,
) -> ImportInboxResult:
    inbox_dir = os.path.abspath(inbox_dir)
    archive_root = os.path.abspath(archive_root)
    db_path = os.path.abspath(db_path)

    os.makedirs(inbox_dir, exist_ok=True)
    os.makedirs(archive_root, exist_ok=True)

    xml_paths = sorted(glob(os.path.join(inbox_dir, "*.xml")))
    details: List[Dict[str, Any]] = []

    if not xml_paths:
        return ImportInboxResult(
            ok=True,
            inbox=inbox_dir,
            archive=archive_root,
            db_path=db_path,
            room=room,
            hero=hero,
            xml_found=0,
            imported_files=0,
            moved_files=0,
            details=[],
        )

    # Importamos desde inbox_dir (import_xml_folder ya recorre carpeta)
    # OJO: import_xml_folder debe ser idempotente con UNIQUE(gamecode) o similar.
    import_xml_folder(folder=inbox_dir, db_path=db_path, room=room, hero=hero)

    # Tras importar, movemos TODOS los .xml a archive/YYYYMMDD/
    day = datetime.now().strftime("%Y%m%d")
    archive_dir = os.path.join(archive_root, day)
    os.makedirs(archive_dir, exist_ok=True)

    moved = 0
    for p in xml_paths:
        base = os.path.basename(p)
        dst = os.path.join(archive_dir, base)

        # Si ya existe, añadimos sufijo incremental
        if os.path.exists(dst):
            name, ext = os.path.splitext(base)
            i = 1
            while True:
                dst2 = os.path.join(archive_dir, f"{name}__{i}{ext}")
                if not os.path.exists(dst2):
                    dst = dst2
                    break
                i += 1

        shutil.move(p, dst)
        moved += 1
        details.append({"file": base, "moved_to": dst})

    return ImportInboxResult(
        ok=True,
        inbox=inbox_dir,
        archive=archive_root,
        db_path=db_path,
        room=room,
        hero=hero,
        xml_found=len(xml_paths),
        imported_files=len(xml_paths),
        moved_files=moved,
        details=details,
    )
