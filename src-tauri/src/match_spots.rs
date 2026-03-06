// C:\Users\Usuario\Desktop\proyectos\poker_boss\src-tauri\src\match_spots.rs

use crate::python::run_python_with_env;

#[tauri::command]
pub async fn match_spots(
    db_path: String,
    spots_dir: String,
    window_ms: i32,
) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let script = r".\modules\preflop\link_hands_real_to_spots.py";

        let out = run_python_with_env(
            &[
                script,
                "--db",
                &db_path,
                "--spots_dir",
                &spots_dir,
                "--window_ms",
                &window_ms.to_string(),
            ],
            None,
        )?;

        Ok(out)
    })
    .await
    .map_err(|e| e.to_string())?
}