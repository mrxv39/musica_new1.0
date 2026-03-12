use std::process::Child;
use std::sync::Mutex;

pub struct WorkersState {
    pub child: Mutex<Option<Child>>,
    pub xml_child: Mutex<Option<Child>>,
    pub last_status: Mutex<String>,
}

impl Default for WorkersState {
    fn default() -> Self {
        Self {
            child: Mutex::new(None),
            xml_child: Mutex::new(None),
            last_status: Mutex::new("workers stopped".to_string()),
        }
    }
}
