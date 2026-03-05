// C:\Users\Usuario\Desktop\proyectos\poker_boss\src-tauri\src\obs.rs

use crate::python::run_python_with_env;

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
pub async fn run_worker_batch(folder_path: String, limit: u32, db_path: String) -> Result<String, String> {
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
pub async fn capture_test_images(out_dir: String) -> Result<String, String> {
    let outd = out_dir;
    tauri::async_runtime::spawn_blocking(move || {
        let script = r".\modules\preflop\capture_test_images.py";
        let out = run_python_with_env(&[script, "--out_dir", &outd], None)?;
        Ok(out.trim().to_string())
    })
    .await
    .map_err(|e| format!("spawn_blocking error: {e}"))?
}