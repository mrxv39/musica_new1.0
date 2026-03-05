// C:\Users\Usuario\Desktop\proyectos\poker_boss\src-tauri\src\workers.rs

use std::fs::OpenOptions;
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};

use crate::python::{run_python_with_env, PROJECT_ROOT};

#[derive(Default)]
pub struct WorkersState {
    pub child: Mutex<Option<Child>>,
    pub last_status: Mutex<String>,
}

#[tauri::command]
pub async fn set_workers_running(
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
pub async fn get_workers_status(state: tauri::State<'_, Arc<WorkersState>>) -> Result<String, String> {
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

// ===== NUEVO: ejecutar 1 tick (o N ticks) de run_workers_loop.py =====
#[tauri::command]
pub async fn run_workers_tick(db_path: String, out_dir: String, interval_ms: u64, max_ticks: u64) -> Result<String, String> {
    let dbp = db_path;
    let outd = out_dir;
    let im = interval_ms;
    let mt = max_ticks;

    tauri::async_runtime::spawn_blocking(move || {
        let loop_script = r".\modules\preflop\run_workers_loop.py";
        let out = run_python_with_env(
            &[
                loop_script,
                "--out_dir",
                &outd,
                "--interval_ms",
                &im.to_string(),
                "--max_ticks",
                &mt.to_string(),
            ],
            Some(&dbp),
        )?;

        Ok(out.trim().to_string())
    })
    .await
    .map_err(|e| format!("spawn_blocking error: {e}"))?
}