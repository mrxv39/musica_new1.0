# C:\Users\Usuario\Desktop\proyectos\poker_boss\tests\test_championpoker_xml_importer.py
from __future__ import annotations

import os
import sqlite3
import tempfile

from modules.importers.championpoker_xml_importer import import_xml_folder


def test_importer_creates_tables_and_imports_one_fixture():
    here = os.path.dirname(os.path.abspath(__file__))
    fixture = os.path.join(here, "fixtures", "champion_sample_min.xml")
    assert os.path.exists(fixture)

    with tempfile.TemporaryDirectory() as td:
        db_path = os.path.join(td, "test.db")

        res = import_xml_folder(
            folder=os.path.dirname(fixture),
            db_path=db_path,
            room="championpoker",
            hero="hero",
            recursive=False,
            verbose=False,
        )
        assert res["ok"] is True
        assert res["hands_imported"] >= 1

        conn = sqlite3.connect(db_path)
        try:
            c = conn.cursor()
            c.execute("SELECT COUNT(*) FROM tournaments")
            assert c.fetchone()[0] == 1

            c.execute("SELECT COUNT(*) FROM hands")
            assert c.fetchone()[0] >= 1

            c.execute(
                """
                SELECT hr.tournament_id, t.tournamentname, t.tournamentcode, t.buyin
                FROM hands hr
                JOIN tournaments t ON t.id = hr.tournament_id
                LIMIT 1
                """
            )
            row = c.fetchone()
            assert row is not None
            assert row[0] is not None
            assert row[1] == "Sunday Special"
            assert row[2] == "T123"
            assert row[3] == "10"

            c.execute("SELECT COUNT(*) FROM actions_real")
            assert c.fetchone()[0] >= 1
        finally:
            conn.close()
