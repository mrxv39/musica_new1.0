#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// C:\Users\Usuario\Desktop\proyectos\poker_boss\src-tauri\src\main.rs

use std::sync::Arc;

mod image_io;
mod import_xml;
mod match_spots;
mod obs;
mod python;
mod reset_real;
mod workers;

fn main() {
    tauri::Builder::default()
        .manage(Arc::new(workers::state::WorkersState::default()))
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            // image io
            image_io::read_image_base64,

            // OBS / batch tools
            obs::reset_hands_obs,
            obs::run_worker_one,
            obs::run_worker_batch,
            obs::capture_test_images,
            obs::get_hand_obs_image,

            // REAL reset
            reset_real::reset_hands_real,

            // workers loop/tick
            workers::commands::set_workers_running,
            workers::commands::get_workers_status,
            workers::commands::run_workers_tick,

            // REAL import
            import_xml::import_champion_xml,

            // REAL ↔ OCR linking
            match_spots::match_spots
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

