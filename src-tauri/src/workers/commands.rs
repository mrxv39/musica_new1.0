// C:\Users\Usuario\Desktop\proyectos\poker_boss\src-tauri\src\workers\commands.rs

use std::process::Command;
use std::sync::Arc;

use crate::python::run_python_with_env;
use crate::python::{PROJECT_ROOT, PY_SCRIPT_LIVE_XML_SYNC, PY_SCRIPT_RUN_WORKERS_LOOP};

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
    xml_dir: Option<String>,
    hero: Option<String>,
) -> Result<String, String> {
    if running {
        {
            let mut guard = state.child.lock().unwrap();
            if guard.is_some() {
                return Ok("workers already running".to_string());
            }

            let log_path = build_log_path(&out_dir)?;
            let mut cmd = build_loop_command(
                &db_path,
                &out_dir,
                interval_ms,
                &log_path,
                xml_dir.as_deref(),
                hero.as_deref(),
            )?;
            let child = cmd
                .spawn()
                .map_err(|e| format!("failed to spawn run_workers_loop.py: {e}"))?;

            *guard = Some(child);

            let xml_dir_s = xml_dir.unwrap_or_default();
            let hero_s = hero.unwrap_or_default();

            if !xml_dir_s.trim().is_empty() && !hero_s.trim().is_empty() {
                let mut xml_guard = state.xml_child.lock().unwrap();

                let xml_child = Command::new("python")
                    .current_dir(PROJECT_ROOT)
                    .arg(PY_SCRIPT_LIVE_XML_SYNC)
                    .arg("--db")
                    .arg(&db_path)
                    .arg("--xml-folder")
                    .arg(&xml_dir_s)
                    .arg("--hero")
                    .arg(&hero_s)
                    .arg("--interval-sec")
                    .arg("8")
                    .env("POKER_BOSS_DB_PATH", &db_path)
                    .env("MUSICA_DB_PATH", &db_path)
                    .spawn()
                    .map_err(|e| format!("failed to spawn live_xml_sync.py: {e}"))?;

                *xml_guard = Some(xml_child);

                let mut ls = state.last_status.lock().unwrap();
                *ls = format!(
                    "workers running | xml sync running | log={} | xml_dir={} | hero={}",
                    log_path, xml_dir_s, hero_s
                );
            } else {
                let mut ls = state.last_status.lock().unwrap();
                *ls = format!("workers running | xml sync disabled | log={}", log_path);
            }
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
            let mut xml_guard = state.xml_child.lock().unwrap();
            if let Some(mut ch) = xml_guard.take() {
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
    let mut workers_running = false;
    let mut workers_pid: Option<u32> = None;
    let mut xml_running = false;
    let mut xml_pid: Option<u32> = None;

    {
        let mut guard = state.child.lock().unwrap();
        if let Some(child) = guard.as_mut() {
            if let Ok(Some(status)) = child.try_wait() {
                let mut ls = state.last_status.lock().unwrap();
                *ls = format!("workers exited: {}", status);
                *guard = None;
            } else {
                workers_running = true;
                workers_pid = Some(child.id());
            }
        }
    }

    {
        let mut xml_guard = state.xml_child.lock().unwrap();
        if let Some(child) = xml_guard.as_mut() {
            if let Ok(Some(_status)) = child.try_wait() {
                *xml_guard = None;
            } else {
                xml_running = true;
                xml_pid = Some(child.id());
            }
        }
    }

    if workers_running {
        let ls = state.last_status.lock().unwrap();
        let xml_part = if xml_running {
            format!(" | xml_sync pid={}", xml_pid.unwrap_or(0))
        } else {
            " | xml_sync stopped".to_string()
        };

        return Ok(format!(
            "workers running | pid={}{} | {}",
            workers_pid.unwrap_or(0),
            xml_part,
            ls.clone()
        ));
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
        let out = run_python_with_env(
            &[
                PY_SCRIPT_RUN_WORKERS_LOOP,
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

