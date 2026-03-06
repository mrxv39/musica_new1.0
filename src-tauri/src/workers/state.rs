// C:\Users\Usuario\Desktop\proyectos\poker_boss\src-tauri\src\workers\state.rs

use std::process::Child;
use std::sync::Mutex;

#[derive(Default)]
pub struct WorkersState {
    pub child: Mutex<Option<Child>>,
    pub last_status: Mutex<String>,
}
