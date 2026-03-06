// C:\Users\Usuario\Desktop\proyectos\poker_boss\src-tauri\src\reset_real.rs

use crate::python::run_python_with_env;

#[tauri::command]
pub async fn reset_hands_real(db_path: String) -> Result<String, String> {
    let dbp = db_path;
    tauri::async_runtime::spawn_blocking(move || {
        let code = "import sqlite3,sys; p=sys.argv[1]; con=sqlite3.connect(p); con.execute('DELETE FROM hands_real'); con.commit(); print('hands_real vaciada correctamente')";
        let out = run_python_with_env(&["-c", code, &dbp], None)?;
        Ok(out.trim().to_string())
    })
    .await
    .map_err(|e| format!("spawn_blocking error: {e}"))?
}
