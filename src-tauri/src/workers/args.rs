// C:\Users\Usuario\Desktop\proyectos\poker_boss\src-tauri\src\workers\args.rs

use serde::Deserialize;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RunWorkersTickArgs {
    pub db_path: String,
    pub out_dir: String,
    pub interval_ms: u64,
    pub max_ticks: u64,
}
