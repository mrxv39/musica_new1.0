// C:\Users\Usuario\Desktop\proyectos\poker_boss\src-tauri\src\match_spots.rs

use crate::python::run_python_with_env;

#[tauri::command]
pub async fn match_spots(
    db_path: String,
    _spots_dir: String,
    _window_ms: i32,
) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let script = r".\modules\preflop\link_hands_obs_to_real.py";

        let out = run_python_with_env(
            &[
                script,
                "--db",
                &db_path,
            ],
            None,
        )?;

        Ok(out)
    })
    .await
    .map_err(|e| e.to_string())?
}
