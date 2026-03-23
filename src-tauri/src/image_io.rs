use std::fs;
use base64::engine::general_purpose::STANDARD;
use base64::Engine;

#[tauri::command]
pub fn read_image_base64(path: String) -> Result<String, String> {
    let bytes = fs::read(&path).map_err(|e| format!("read error: {}", e))?;
    Ok(STANDARD.encode(bytes))
}
