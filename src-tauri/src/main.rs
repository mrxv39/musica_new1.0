#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// C:\Users\Usuario\Desktop\proyectos\poker_boss\src-tauri\src\main.rs

use std::sync::Arc;

mod python;
mod obs;
mod workers;
mod import_xml;

fn main() {
    tauri::Builder::default()
        .manage(Arc::new(workers::WorkersState::default()))
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            // OBS / batch tools
            obs::reset_hands_obs,
            obs::run_worker_one,
            obs::run_worker_batch,
            obs::capture_test_images,
            // workers loop/tick
            workers::set_workers_running,
            workers::get_workers_status,
            workers::run_workers_tick,
            // REAL import
            import_xml::import_champion_xml
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}