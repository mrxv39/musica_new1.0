use crate::python::PROJECT_ROOT;
use tauri;

#[tauri::command]
pub async fn reset_hands_real(db_path: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let code = "import sqlite3,sys; p=sys.argv[1]; con=sqlite3.connect(p); \
con.execute('DELETE FROM spot_links'); \
con.execute('DELETE FROM spots_xml_real'); \
con.execute('DELETE FROM spots_real'); \
con.execute('DELETE FROM actions_real'); \
con.execute('DELETE FROM hand_links'); \
con.execute('DELETE FROM hands_real'); \
con.commit(); \
print('hands_real, hand_links, actions_real, spots_real, spots_xml_real y spot_links vaciadas correctamente')";

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

/// Vacia las 4 tablas lógicas: spot_links, spots_*, actions_real, hand_links, hands_real, hands_obs, tournaments, players.
#[tauri::command]
pub async fn reset_four_tables(db_path: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let code = "import sqlite3,sys; p=sys.argv[1]; con=sqlite3.connect(p); \
con.execute('DELETE FROM spot_links'); \
con.execute('DELETE FROM spots_xml_real'); \
con.execute('DELETE FROM spots_real'); \
con.execute('DELETE FROM actions_real'); \
con.execute('DELETE FROM hand_links'); \
con.execute('DELETE FROM hands_real'); \
con.execute('DELETE FROM hands_obs'); \
con.execute('DELETE FROM tournaments'); \
con.execute('DELETE FROM players'); \
con.commit(); \
print('tournaments, hands, spots y players (4 tablas) vaciadas correctamente')";

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
