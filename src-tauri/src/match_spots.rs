// C:\Users\Usuario\Desktop\proyectos\poker_boss\src-tauri\src\match_spots.rs

use crate::python::{
    run_python_with_env,
    PY_SCRIPT_LINK_HANDS_OBS_TO_REAL,
    PY_SCRIPT_LINK_HANDS_OBS_TO_SPOTS_XML_REAL,
};

#[tauri::command]
pub async fn match_spots(
    db_path: String,
    // Reserved for future folder-based filtering of spot matching.
    _spots_dir: String,
    // Reserved for future time-window filtering during matching.
    _window_ms: i32,
) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let hand_links_out = run_python_with_env(
            &[
                PY_SCRIPT_LINK_HANDS_OBS_TO_REAL,
                "--db",
                &db_path,
            ],
            None,
        )?;

        let spot_links_out = run_python_with_env(
            &[
                PY_SCRIPT_LINK_HANDS_OBS_TO_SPOTS_XML_REAL,
                "--db",
                &db_path,
            ],
            None,
        )?;

        let hand_msg = hand_links_out.trim();
        let spot_msg = spot_links_out.trim();

        Ok(match (hand_msg.is_empty(), spot_msg.is_empty()) {
            (true, true) => "match_spots: ok".to_string(),
            (false, true) => hand_msg.to_string(),
            (true, false) => spot_msg.to_string(),
            (false, false) => format!("{hand_msg}`n{spot_msg}"),
        })
    })
    .await
    .map_err(|e| e.to_string())?
}
