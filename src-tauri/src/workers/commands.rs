// C:\Users\Usuario\Desktop\proyectos\poker_boss\src-tauri\src\workers\commands.rs

use std::sync::Arc;

use crate::python::run_python_with_env;

use super::args::RunWorkersTickArgs;
use super::process::{build_log_path, build_loop_command};
use super::state::WorkersState;

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

            let log_path = build_log_path(&out_dir)?;
            let mut cmd = build_loop_command(&db_path, &out_dir, interval_ms, &log_path)?;
            let child = cmd
                .spawn()
                .map_err(|e| format!("failed to spawn run_workers_loop.py: {e}"))?;

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
pub async fn get_workers_status(
    state: tauri::State<'_, Arc<WorkersState>>,
) -> Result<String, String> {
    {
        let mut guard = state.child.lock().unwrap();
        if let Some(child) = guard.as_mut() {
            if let Ok(Some(status)) = child.try_wait() {
                let mut ls = state.last_status.lock().unwrap();
                *ls = format!("workers exited: {}", status);
                *guard = None;
            } else {
                let pid = child.id();
                let ls = state.last_status.lock().unwrap();
                return Ok(format!("workers running | pid={} | {}", pid, ls.clone()));
            }
        }
    }

    let ls = state.last_status.lock().unwrap();
    Ok(ls.clone())
}

#[tauri::command]
pub async fn run_workers_tick(args: RunWorkersTickArgs) -> Result<String, String> {
    let dbp = args.db_path;
    let outd = args.out_dir;
    let im = args.interval_ms;
    let mt = args.max_ticks;

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
