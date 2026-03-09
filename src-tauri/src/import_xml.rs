// C:\Users\Usuario\Desktop\proyectos\poker_boss\src-tauri\src\import_xml.rs

use crate::python::run_python_with_env;

// ===== IMPORT XML (con HERO) + AUTO MATCH OCR =====
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

        let import_out = run_python_with_env(
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

        let match_script = r".\modules\preflop\link_hands_obs_to_real.py";

        let match_out = run_python_with_env(
            &[
                match_script,
                "--db",
                &dbp,
            ],
            None,
        )?;

        let import_msg = import_out.trim();
        let match_msg = match_out.trim();

        let combined = match (import_msg.is_empty(), match_msg.is_empty()) {
            (true, true) => "import xml + match images: ok".to_string(),
            (false, true) => format!("{import_msg}`n[auto match] ok"),
            (true, false) => format!("import xml: ok`n{match_msg}"),
            (false, false) => format!("{import_msg}`n{match_msg}"),
        };

        Ok(combined)
    })
    .await
    .map_err(|e| format!("spawn_blocking error: {e}"))?
}
