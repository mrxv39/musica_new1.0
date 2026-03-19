// C:\Users\Usuario\Desktop\proyectos\poker_boss\src-tauri\src\obs.rs

use crate::python::{
    run_python_with_env,
    PY_SCRIPT_CAPTURE_TEST_IMAGES,
    PY_SCRIPT_WORKER,
};

#[tauri::command]
pub async fn reset_hands_obs(db_path: String) -> Result<String, String> {
    let dbp = db_path;
    tauri::async_runtime::spawn_blocking(move || {
        let code = "import sqlite3,sys; p=sys.argv[1]; con=sqlite3.connect(p); con.execute('DELETE FROM hands_obs'); con.commit(); print('hands_obs vaciada correctamente')";
        let out = run_python_with_env(&["-c", code, &dbp], None)?;
        Ok(out.trim().to_string())
    })
    .await
    .map_err(|e| format!("spawn_blocking error: {e}"))?
}

#[tauri::command]
pub async fn run_worker_one(image_path: String, db_path: String) -> Result<String, String> {
    let img = image_path;
    let dbp = db_path;
    tauri::async_runtime::spawn_blocking(move || {
        let out = run_python_with_env(
            &[
                PY_SCRIPT_WORKER,
                "--id",
                "1",
                "--image",
                &img,
                "--max_ticks",
                "1",
                "--print_every_tick",
                "true",
                "--persist_without_stack",
                "true",
            ],
            Some(&dbp),
        )?;
        Ok(out.trim().to_string())
    })
    .await
    .map_err(|e| format!("spawn_blocking error: {e}"))?
}

#[tauri::command]
pub async fn run_worker_batch(folder_path: String, limit: u32, db_path: String) -> Result<String, String> {
    let folder = folder_path;
    let limit_u = limit;
    let dbp = db_path;

    tauri::async_runtime::spawn_blocking(move || {
        let out = run_python_with_env(
            &[
                PY_SCRIPT_WORKER,
                "--id",
                "1",
                "--images_dir",
                &folder,
                "--loop",
                "false",
                "--max_ticks",
                &limit_u.to_string(),
                "--print_every_tick",
                "false",
                "--persist_without_stack",
                "true",
            ],
            Some(&dbp),
        )?;

        Ok(format!(
            "replay_dir done (max_ticks={}) folder={} db={}\n{}",
            limit_u,
            folder,
            dbp,
            out.trim()
        ))
    })
    .await
    .map_err(|e| format!("spawn_blocking error: {e}"))?
}

#[tauri::command]
pub async fn capture_test_images(out_dir: String) -> Result<String, String> {
    let outd = out_dir;
    tauri::async_runtime::spawn_blocking(move || {
        let out = run_python_with_env(&[PY_SCRIPT_CAPTURE_TEST_IMAGES, "--out_dir", &outd], None)?;
        Ok(out.trim().to_string())
    })
    .await
    .map_err(|e| format!("spawn_blocking error: {e}"))?
}

#[tauri::command]
pub fn get_hand_obs_image(db_path: String, gamecode: String) -> Result<Option<String>, String> {
    use rusqlite::Connection;

    let conn = Connection::open(db_path).map_err(|e| e.to_string())?;

    let mut stmt = conn.prepare(
        "
        SELECT
            NULLIF(h.frame_ref, '') AS img_path
        FROM hand_links l
        JOIN hands_obs h
          ON h.obs_id = l.obs_id
        WHERE l.gamecode = ?
        LIMIT 1
        "
    ).map_err(|e| e.to_string())?;

    let mut rows = stmt.query([gamecode]).map_err(|e| e.to_string())?;

    if let Some(row) = rows.next().map_err(|e| e.to_string())? {
        let path: Option<String> = row.get(0).map_err(|e| e.to_string())?;
        Ok(path.filter(|p| !p.trim().is_empty()))
    } else {
        Ok(None)
    }
}

#[derive(serde::Serialize)]
pub struct MesaOverlayState {
    pub mesa: i64,
    pub table_id: String,
    pub last_detected_at_ms: Option<i64>,
    pub preflop_ok: bool,
    pub frame_ref: Option<String>,
    pub strategy_ready: bool,
    pub hand_class: Option<String>,
    pub move_: Option<String>,
    pub betmin: Option<f64>,
    pub betmax: Option<f64>,
}

#[tauri::command]
pub fn get_mesas_overlay_state(db_path: String) -> Result<Vec<MesaOverlayState>, String> {
    let con = rusqlite::Connection::open(db_path)
        .map_err(|e| e.to_string())?;

    let mut out: Vec<MesaOverlayState> = Vec::new();

    for mesa in 1..=4 {
        let table_id = format!("mesa_{}", mesa);

        let mut stmt = con.prepare(
            "
            SELECT detected_at_ms, preflop_ok, frame_ref, hand_class,
                   json_extract(ocr_json, '$.strategy.move') as strategy_move,
                   json_extract(ocr_json, '$.strategy.betmin') as strategy_betmin,
                   json_extract(ocr_json, '$.strategy.betmax') as strategy_betmax
            FROM hands_obs
            WHERE table_id = ?
            ORDER BY detected_at_ms DESC, obs_id DESC
            LIMIT 1
            "
        ).map_err(|e| e.to_string())?;

        let mut rows = stmt.query([table_id.clone()])
            .map_err(|e| e.to_string())?;

        if let Some(row) = rows.next().map_err(|e| e.to_string())? {
            let detected: Option<i64> = row.get(0).unwrap_or(None);
            let ok: i64 = row.get(1).unwrap_or(0);
            let frame: Option<String> = row.get(2).unwrap_or(None);
            let hand_class: Option<String> = row.get(3).unwrap_or(None);
            let strategy_move: Option<String> = row.get(4).unwrap_or(None);
            let strategy_betmin: Option<f64> = row.get(5).unwrap_or(None);
            let strategy_betmax: Option<f64> = row.get(6).unwrap_or(None);

            let strategy_ready = strategy_move.as_ref()
                .map(|m| !m.trim().is_empty())
                .unwrap_or(false);

            out.push(MesaOverlayState {
                mesa,
                table_id,
                last_detected_at_ms: detected,
                preflop_ok: ok == 1,
                frame_ref: frame,
                strategy_ready,
                hand_class,
                move_: strategy_move,
                betmin: strategy_betmin,
                betmax: strategy_betmax,
            });
        } else {
            out.push(MesaOverlayState {
                mesa,
                table_id,
                last_detected_at_ms: None,
                preflop_ok: false,
                frame_ref: None,
                strategy_ready: false,
                hand_class: None,
                move_: None,
                betmin: None,
                betmax: None,
            });
        }
    }

    Ok(out)
}

#[tauri::command]
pub async fn capture_single_mesa(mesa: i64) -> Result<String, String> {
    let mesa_s = mesa.to_string();

    tauri::async_runtime::spawn_blocking(move || {
        let py = r#"
import os
import sys
from datetime import datetime
from modules.preflop.workers_loop.config import AREAS
from modules.preflop.workers_loop.capture import capture_bbox_to_path

mesa = int(sys.argv[1])

area = None
for a in AREAS:
    if int(a["mesa"]) == mesa:
        area = a
        break

if area is None:
    raise RuntimeError(f"mesa_not_found:{mesa}")

bbox = (int(area["x1"]), int(area["y1"]), int(area["x2"]), int(area["y2"]))

root = os.path.abspath(".")
day = datetime.now().strftime("%Y%m%d")
ts = datetime.now().strftime("%Y%m%d_%H%M%S_%f")

out_dir = os.path.join(root, "data", "spots_raw", "manual_captures", day)
os.makedirs(out_dir, exist_ok=True)

out_path = os.path.join(out_dir, f"{ts}__mesa_{mesa}.bmp")
capture_bbox_to_path(bbox, out_path)

print(out_path)
"#;

        let out = run_python_with_env(&["-c", py, &mesa_s], None)?;
        Ok(out.trim().to_string())
    })
    .await
    .map_err(|e| format!("spawn_blocking error: {e}"))?
}
