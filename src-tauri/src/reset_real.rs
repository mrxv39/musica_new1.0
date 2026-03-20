use crate::python::PROJECT_ROOT;
use tauri;

#[tauri::command]
pub async fn reset_hands(db_path: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let code = "import sqlite3,sys; p=sys.argv[1]; con=sqlite3.connect(p); \
con.execute('DELETE FROM hands'); \
con.commit(); \
print('hands vaciada correctamente')";

        let output = std::process::Command::new("python")
            .current_dir(PROJECT_ROOT)
            .arg("-c")
            .arg(code)
            .arg(&db_path)
            .env("PYTHONPATH", PROJECT_ROOT)
            .output()
            .map_err(|e| e.to_string())?;

        if !output.status.success() {
            return Err(String::from_utf8_lossy(&output.stderr).to_string());
        }

        Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Vacia las 4 tablas: hands, spots, tournaments, players.
#[tauri::command]
pub async fn reset_four_tables(db_path: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let code = "import sqlite3,sys; p=sys.argv[1]; con=sqlite3.connect(p); \
con.execute('DELETE FROM hands'); \
con.execute('DELETE FROM spots'); \
con.execute('DELETE FROM tournaments'); \
con.execute('DELETE FROM players'); \
con.commit(); \
print('hands, spots, tournaments, players vaciadas correctamente')";

        let output = std::process::Command::new("python")
            .current_dir(PROJECT_ROOT)
            .arg("-c")
            .arg(code)
            .arg(&db_path)
            .env("PYTHONPATH", PROJECT_ROOT)
            .output()
            .map_err(|e| e.to_string())?;

        if !output.status.success() {
            return Err(String::from_utf8_lossy(&output.stderr).to_string());
        }

        Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}
