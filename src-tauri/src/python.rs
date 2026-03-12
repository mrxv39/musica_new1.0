// C:\Users\Usuario\Desktop\proyectos\poker_boss\src-tauri\src\python.rs

use std::process::Command;

pub const PROJECT_ROOT: &str = r"C:\Users\Usuario\Desktop\proyectos\poker_boss";

/// Python script paths relative to PROJECT_ROOT (centralized for future config).
pub const PY_SCRIPT_WORKER: &str = r".\modules\workers\worker.py";
pub const PY_SCRIPT_CAPTURE_TEST_IMAGES: &str = r".\modules\preflop\capture_test_images.py";
pub const PY_SCRIPT_IMPORT_XML: &str = r".\modules\preflop\import_xml.py";
pub const PY_SCRIPT_LINK_HANDS_OBS_TO_SPOTS_XML_REAL: &str =
    r".\modules\preflop\link_hands_obs_to_spots_xml_real.py";
pub const PY_SCRIPT_LINK_HANDS_OBS_TO_REAL: &str = r".\modules\preflop\link_hands_obs_to_real.py";
pub const PY_SCRIPT_LIVE_XML_SYNC: &str = r".\modules\preflop\live_xml_sync.py";
pub const PY_SCRIPT_RUN_WORKERS_LOOP: &str = r".\modules\preflop\run_workers_loop.py";

pub fn run_python_with_env(args: &[&str], db_path_env: Option<&str>) -> Result<String, String> {
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