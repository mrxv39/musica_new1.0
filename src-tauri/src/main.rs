#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::fs::OpenOptions;

const PROJECT_ROOT: &str = r"C:\Users\Usuario\Desktop\proyectos\poker_boss";

fn run_python_with_env(args: &[&str], db_path_env: Option<&str>) -> Result<String, String> {
    let mut cmd = Command::new("python");
    cmd.args(args).current_dir(PROJECT_ROOT);

    if let Some(p) = db_path_env {
        cmd.env("POKER_BOSS_DB_PATH", p);
        cmd.env("MUSICA_DB_PATH", p);
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
        let script = r".\modules\workers\worker.py";
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
async fn capture_test_images(out_dir: String) -> Result<String, String> {
    let outd = out_dir;
    tauri::async_runtime::spawn_blocking(move || {
        let script = r".\modules\preflop\capture_test_images.py";
        let out = run_python_with_env(&[script, "--out_dir", &outd], None)?;
        Ok(out.trim().to_string())
    })
    .await
    .map_err(|e| format!("spawn_blocking error: {e}"))?
}

#[derive(Default)]
struct WorkersState {
    child: Mutex<Option<Child>>,
    last_status: Mutex<String>,
}

#[tauri::command]
async fn set_workers_running(
    state: tauri::State<'_, Arc<WorkersState>>,
    running: bool,
    db_path: String,
    out_dir: String,
    interval_ms: u64,
) -> Result<String, String> {
    if running {
        {
            let mut guard = state.child.lock().unwrap();
            if guard.is_some() {
                return Ok("workers already running".to_string());
            }

            // log file
            let log_dir = format!(r"{}\_logs", out_dir);
            let _ = std::fs::create_dir_all(&log_dir);
            let log_path = format!(r"{}\run_workers_loop.log", log_dir);

            let log_file = OpenOptions::new()
                .create(true)
                .append(true)
                .open(&log_path)
                .map_err(|e| format!("failed to open log file {}: {}", log_path, e))?;

            let log_file_err = OpenOptions::new()
                .create(true)
                .append(true)
                .open(&log_path)
                .map_err(|e| format!("failed to open log file {}: {}", log_path, e))?;

            let mut cmd = Command::new("python");
            cmd.current_dir(PROJECT_ROOT)
                .arg(r".\modules\preflop\run_workers_loop.py")
                .arg("--out_dir")
                .arg(&out_dir)
                .arg("--interval_ms")
                .arg(interval_ms.to_string())
                .arg("--verbose")
                .env("POKER_BOSS_DB_PATH", &db_path)
                .env("MUSICA_DB_PATH", &db_path)
                .stdin(Stdio::null())
                .stdout(Stdio::from(log_file))
                .stderr(Stdio::from(log_file_err));

            // Propaga debug flag si está en el entorno del proceso Tauri
            if let Ok(v) = std::env::var("POKER_BOSS_WORKERS_LOOP_DEBUG") {
                if !v.trim().is_empty() {
                    cmd.env("POKER_BOSS_WORKERS_LOOP_DEBUG", v);
                }
            }

            let child = cmd.spawn().map_err(|e| format!("failed to spawn run_workers_loop.py: {e}"))?;
            *guard = Some(child);

            let mut ls = state.last_status.lock().unwrap();
            *ls = format!("workers running | log={}", log_path);
        }

        Ok("workers started".to_string())
    } else {
        {
            let mut guard = state.child.lock().unwrap();
            if let Some(mut ch) = guard.take() {
                let _ = ch.kill();
                // Windows: espera a que el proceso realmente termine para no dejar locks/handles vivos
                let _ = ch.wait();
            }
        }
        {
            let mut ls = state.last_status.lock().unwrap();
            *ls = "workers stopped".to_string();
        }
        Ok("workers stopping".to_string())
    }
}

#[tauri::command]
async fn get_workers_status(state: tauri::State<'_, Arc<WorkersState>>) -> Result<String, String> {
    // check if exited
    {
        let mut guard = state.child.lock().unwrap();
        if let Some(child) = guard.as_mut() {
            if let Ok(Some(status)) = child.try_wait() {
                let mut ls = state.last_status.lock().unwrap();
                *ls = format!("workers exited: {}", status);
                *guard = None;
            } else {
                // sigue vivo -> devuelve pid + last_status
                let pid = child.id();
                let ls = state.last_status.lock().unwrap();
                return Ok(format!("workers running | pid={} | {}", pid, ls.clone()));
            }
        }
    }

    let ls = state.last_status.lock().unwrap();
    Ok(ls.clone())
}

fn main() {
    tauri::Builder::default()
        .manage(Arc::new(WorkersState::default()))
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            reset_hands_obs,
            run_worker_one,
            run_worker_batch,
            capture_test_images,
            set_workers_running,
            get_workers_status
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}