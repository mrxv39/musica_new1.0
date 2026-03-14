// C:\Users\Usuario\Desktop\proyectos\poker_boss\src-tauri\src\workers\process.rs

use std::fs::OpenOptions;
use std::process::{Command, Stdio};

use crate::python::{PROJECT_ROOT, PY_SCRIPT_RUN_WORKERS_LOOP};

pub fn build_log_path(out_dir: &str) -> Result<String, String> {
    let log_dir = format!(r"{}\_logs", out_dir);
    std::fs::create_dir_all(&log_dir)
        .map_err(|e| format!("failed to create log dir {}: {}", log_dir, e))?;
    Ok(format!(r"{}\run_workers_loop.log", log_dir))
}

pub fn build_loop_command(
    db_path: &str,
    out_dir: &str,
    interval_ms: u64,
    log_path: &str,
    xml_dir: Option<&str>,
    hero: Option<&str>,
) -> Result<Command, String> {
    let log_file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(log_path)
        .map_err(|e| format!("failed to open log file {}: {}", log_path, e))?;

    let log_file_err = OpenOptions::new()
        .create(true)
        .append(true)
        .open(log_path)
        .map_err(|e| format!("failed to open log file {}: {}", log_path, e))?;

    let mut cmd = Command::new("python");
    cmd.current_dir(PROJECT_ROOT)
        .arg(PY_SCRIPT_RUN_WORKERS_LOOP)
        .arg("--out_dir")
        .arg(out_dir)
        .arg("--interval_ms")
        .arg(interval_ms.to_string())
        .arg("--verbose")
        .env("POKER_BOSS_DB_PATH", db_path)
        .env("MUSICA_DB_PATH", db_path)
        .stdin(Stdio::null())
        .stdout(Stdio::from(log_file))
        .stderr(Stdio::from(log_file_err));

    if let Ok(v) = std::env::var("POKER_BOSS_WORKERS_LOOP_DEBUG") {
        if !v.trim().is_empty() {
            cmd.env("POKER_BOSS_WORKERS_LOOP_DEBUG", v);
        }
    }

    if let Some(v) = xml_dir {
        if !v.trim().is_empty() {
            cmd.env("POKER_BOSS_XML_DIR", v);
        }
    }

    if let Some(v) = hero {
        if !v.trim().is_empty() {
            cmd.env("POKER_BOSS_HERO", v);
        }
    }

    Ok(cmd)
}

#[cfg(test)]
mod tests {
    use super::{build_log_path, build_loop_command};
    use std::time::{SystemTime, UNIX_EPOCH};

    fn unique_temp_dir(prefix: &str) -> String {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("time")
            .as_nanos();

        let dir = std::env::temp_dir().join(format!("{}_{}", prefix, now));
        std::fs::create_dir_all(&dir).expect("create temp dir");
        dir.to_string_lossy().to_string()
    }

    #[test]
    fn build_log_path_creates_workers_log_path() {
        let out_dir = unique_temp_dir("poker_boss_workers_out");
        let log_path = build_log_path(&out_dir).expect("build_log_path");

        assert!(log_path.ends_with(r"_logs\run_workers_loop.log"));
        assert!(std::path::Path::new(&format!(r"{}\_logs", out_dir)).exists());
    }

    #[test]
    fn build_loop_command_points_to_run_workers_loop_py() {
        let out_dir = unique_temp_dir("poker_boss_workers_out");
        let log_path = build_log_path(&out_dir).expect("build_log_path");

        let cmd = build_loop_command(
            r"C:\db\poker_boss.db",
            &out_dir,
            3000,
            &log_path,
            Some(r"C:\xml"),
            Some("Hero"),
        )
        .expect("build_loop_command");

        let program = cmd.get_program().to_string_lossy().to_string();
        let args: Vec<String> = cmd
            .get_args()
            .map(|a| a.to_string_lossy().to_string())
            .collect();

        let envs: Vec<(String, String)> = cmd
            .get_envs()
            .filter_map(|(k, v)| v.map(|vv| (k.to_string_lossy().to_string(), vv.to_string_lossy().to_string())))
            .collect();

        assert_eq!(program, "python");
        assert!(args.contains(&r".\modules\preflop\run_workers_loop.py".to_string()));
        assert!(args.contains(&"--out_dir".to_string()));
        assert!(args.contains(&out_dir));
        assert!(args.contains(&"--interval_ms".to_string()));
        assert!(args.contains(&"3000".to_string()));
        assert!(args.contains(&"--verbose".to_string()));

        assert!(envs.iter().any(|(k, v)| k == "POKER_BOSS_DB_PATH" && v == r"C:\db\poker_boss.db"));
        assert!(envs.iter().any(|(k, v)| k == "MUSICA_DB_PATH" && v == r"C:\db\poker_boss.db"));
        assert!(envs.iter().any(|(k, v)| k == "POKER_BOSS_XML_DIR" && v == r"C:\xml"));
        assert!(envs.iter().any(|(k, v)| k == "POKER_BOSS_HERO" && v == "Hero"));
    }
}
