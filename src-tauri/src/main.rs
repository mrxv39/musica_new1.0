#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::process::Command;

const PROJECT_ROOT: &str = r"C:\Users\Usuario\Desktop\proyectos\poker_boss";

fn run_python_with_env(args: &[&str], db_path_env: Option<&str>) -> Result<String, String> {
    let mut cmd = Command::new("python");
    cmd.args(args).current_dir(PROJECT_ROOT);

    if let Some(p) = db_path_env {
        cmd.env("POKER_BOSS_DB_PATH", p);
    }

    let out = cmd.output().map_err(|e| format!("failed to spawn python: {e}"))?;

    if !out.status.success() {
        let stderr = String::from_utf8_lossy(&out.stderr).to_string();
        let stdout = String::from_utf8_lossy(&out.stdout).to_string();
        return Err(format!(
            "python failed (code={:?})\nSTDOUT:\n{}\nSTDERR:\n{}",
            out.status.code(),
            stdout,
            stderr
        ));
    }

    Ok(String::from_utf8_lossy(&out.stdout).to_string())
}

#[tauri::command]
async fn reset_hands_obs(db_path: String) -> Result<String, String> {
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
async fn run_worker_one(image_path: String, db_path: String) -> Result<String, String> {
    let img = image_path;
    let dbp = db_path;
    tauri::async_runtime::spawn_blocking(move || {
        let script = r".\modules\workers\worker.py";
        let out = run_python_with_env(
            &[
                script,
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
async fn run_worker_batch(folder_path: String, limit: u32, db_path: String) -> Result<String, String> {
    let folder = folder_path;
    let limit_u = limit;
    let dbp = db_path;

    tauri::async_runtime::spawn_blocking(move || {
        let dir = std::path::Path::new(&folder);
        if !dir.exists() {
            return Err(format!("folder does not exist: {}", folder));
        }
        if !dir.is_dir() {
            return Err(format!("not a folder: {}", folder));
        }

        let script = r".\modules\workers\worker.py";

        // replay_dir mode: --images_dir + --max_ticks N
        let out = run_python_with_env(
            &[
                script,
                "--id",
                "1",
                "--images_dir",
                &folder,
                "--loop",
                "false",
                "--max_ticks",
                &limit_u.to_string(),
                "--print_every_tick",
                "true",
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

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            reset_hands_obs,
            run_worker_one,
            run_worker_batch
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
