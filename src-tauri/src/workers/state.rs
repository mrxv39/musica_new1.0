use std::process::Child;
use std::sync::Mutex;

pub const WORKER_INSTANCE_COUNT: usize = 4;

pub struct WorkersState {
    /// 4 worker loop processes (run_workers_loop.py), one per instance.
    pub children: Mutex<Vec<Option<Child>>>,
    pub xml_child: Mutex<Option<Child>>,
    pub last_status: Mutex<String>,
}

impl Default for WorkersState {
    fn default() -> Self {
        Self {
            children: Mutex::new(std::iter::repeat_with(|| None).take(WORKER_INSTANCE_COUNT).collect()),
            xml_child: Mutex::new(None),
            last_status: Mutex::new("workers stopped".to_string()),
        }
    }
}
