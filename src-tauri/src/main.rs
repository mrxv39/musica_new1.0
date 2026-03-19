#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// C:\Users\Usuario\Desktop\proyectos\poker_boss\src-tauri\src\main.rs

use std::sync::Arc;
use tauri::{Manager, PhysicalPosition, PhysicalSize, WebviewUrl, WebviewWindowBuilder};

mod image_io;
mod import_xml;
mod match_spots;
mod obs;
mod python;
mod reset_real;
mod workers;

fn show_window(app: &tauri::AppHandle, label: &str) -> Result<(), String> {
    let w = app
        .get_webview_window(label)
        .ok_or_else(|| format!("window not found: {}", label))?;
    w.show().map_err(|e| e.to_string())?;
    Ok(())
}

fn hide_window(app: &tauri::AppHandle, label: &str) -> Result<(), String> {
    let w = app
        .get_webview_window(label)
        .ok_or_else(|| format!("window not found: {}", label))?;
    w.hide().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn show_overlay(app: tauri::AppHandle) -> Result<(), String> {
    show_window(&app, "overlay")?;
    if let Some(w) = app.get_webview_window("overlay") {
        let _ = w.set_ignore_cursor_events(true);
    }
    Ok(())
}

#[tauri::command]
fn hide_overlay(app: tauri::AppHandle) -> Result<(), String> {
    hide_window(&app, "overlay")?;
    Ok(())
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let overlay = WebviewWindowBuilder::new(
                app,
                "overlay",
                WebviewUrl::App("overlay.html".into()),
            )
            .decorations(false)
            .transparent(true)
            .always_on_top(true)
            .skip_taskbar(true)
            .resizable(false)
            .title("overlay")
            .inner_size(2200.0, 1500.0)
            .position(0.0, 0.0)
            .build()?;

            let _ = overlay.set_size(PhysicalSize::new(2200, 1500));
            let _ = overlay.set_position(PhysicalPosition::new(0, 0));
            let _ = overlay.set_ignore_cursor_events(true);
            overlay.hide()?;

            Ok(())
        })
        .manage(Arc::new(workers::state::WorkersState::default()))
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            // image io
            image_io::read_image_base64,

            // overlay
            show_overlay,
            hide_overlay,

            // OBS tools (dev/CLI only: run_worker_one, run_worker_batch, capture_test_images)
            obs::reset_hands_obs,
            obs::run_worker_one,
            obs::run_worker_batch,
            obs::capture_test_images,
            obs::get_hand_obs_image,
            obs::get_mesas_overlay_state,
            obs::capture_single_mesa,

            // REAL reset
            reset_real::reset_hands_real,
            reset_real::reset_four_tables,

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
