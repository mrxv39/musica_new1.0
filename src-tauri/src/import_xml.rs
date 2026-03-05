// C:\Users\Usuario\Desktop\proyectos\poker_boss\src-tauri\src\import_xml.rs

use crate::python::run_python_with_env;

// ===== IMPORT XML (con HERO) =====
//
// OJO: import_xml.py exige:
//   --folder FOLDER --db DB --hero HERO [--quiet]
// y NO acepta --xml_dir / --archive_dir.
//
#[tauri::command]
pub async fn import_champion_xml(
    db_path: String,
    xml_dir: String,
    archive_dir: String,
    hero: String,
) -> Result<String, String> {
    let dbp = db_path;
    let xmld = xml_dir;
    let _archd = archive_dir; // por ahora no lo pasamos al script para no romper flags
    let hero_name = hero;

    tauri::async_runtime::spawn_blocking(move || {
        let import_script = r".\modules\preflop\import_xml.py";

        let out = run_python_with_env(
            &[
                import_script,
                "--folder",
                &xmld,
                "--db",
                &dbp,
                "--hero",
                &hero_name,
                "--quiet",
            ],
            Some(&dbp),
        )?;

        Ok(out.trim().to_string())
    })
    .await
    .map_err(|e| format!("spawn_blocking error: {e}"))?
}