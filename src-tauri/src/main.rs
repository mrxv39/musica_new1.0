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
    show_window(&app, "overlay_btn_1")?;
    show_window(&app, "overlay_btn_2")?;
    show_window(&app, "overlay_btn_3")?;
    show_window(&app, "overlay_btn_4")?;

    if let Some(w) = app.get_webview_window("overlay") {
        let _ = w.set_ignore_cursor_events(true);
    }

    Ok(())
}

#[tauri::command]
fn hide_overlay(app: tauri::AppHandle) -> Result<(), String> {
    hide_window(&app, "overlay")?;
    hide_window(&app, "overlay_btn_1")?;
    hide_window(&app, "overlay_btn_2")?;
    hide_window(&app, "overlay_btn_3")?;
    hide_window(&app, "overlay_btn_4")?;
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

            // botones manuales:
            // led M1 x=953 y=681 -> boton y ~657
            // led M2 x=953 y=1278 -> boton y ~1254
            // led M3 x=1729 y=681 -> boton y ~657
            // led M4 x=1729 y=1278 -> boton y ~1254
            let buttons = [
                ("overlay_btn_1", 953.0, 657.0, 1),
                ("overlay_btn_2", 953.0, 1254.0, 2),
                ("overlay_btn_3", 1729.0, 657.0, 3),
                ("overlay_btn_4", 1729.0, 1254.0, 4),
            ];

            for (label, x, y, mesa) in buttons {
                let url = format!("overlay_button.html?mesa={}", mesa);

                let w = WebviewWindowBuilder::new(
                    app,
                    label,
                    WebviewUrl::App(url.into()),
                )
                .decorations(false)
                .transparent(true)
                .always_on_top(true)
                .skip_taskbar(true)
                .resizable(false)
                .title(label)
                .inner_size(24.0, 24.0)
                .position(x, y)
                .build()?;

                let _ = w.set_size(PhysicalSize::new(24, 24));
                let _ = w.set_position(PhysicalPosition::new(x as i32, y as i32));
                w.hide()?;
            }

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

            // OBS / batch tools
            obs::reset_hands_obs,
            obs::run_worker_one,
            obs::run_worker_batch,
            obs::capture_test_images,
            obs::get_hand_obs_image,
            obs::get_mesas_overlay_state,
            obs::capture_single_mesa,

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
