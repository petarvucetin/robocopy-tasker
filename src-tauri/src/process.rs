use crate::models::{RunningTask, Task};
use std::collections::{HashMap, HashSet};
use std::process::{Child, Command};
use std::sync::{Arc, Mutex};

struct RunningEntry {
    info: RunningTask,
    child: Arc<Mutex<Child>>,
}

pub struct ProcessManager {
    running: Mutex<HashMap<String, RunningEntry>>,
    cancelled: Mutex<HashSet<String>>,
}

/// Resolve the log file path for a task. This is the single source of truth
/// for computing log paths used by both `build_args` and background log reading.
///
/// If the task has a custom log path set in `options.log`, it is returned as-is.
/// Otherwise, an auto-generated path is created from the task name within the
/// given `log_directory`.
pub fn resolve_log_path(task: &Task, log_directory: &str) -> String {
    if let Some(ref custom) = task.options.log {
        return custom.clone();
    }
    let safe_name: String = task
        .name
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '-' || c == '_' {
                c
            } else {
                '-'
            }
        })
        .collect();
    format!("{}\\{}.log", log_directory, safe_name)
}

impl ProcessManager {
    pub fn new() -> Self {
        Self {
            running: Mutex::new(HashMap::new()),
            cancelled: Mutex::new(HashSet::new()),
        }
    }

    pub fn build_args(task: &Task, log_directory: &str) -> Vec<String> {
        let opts = &task.options;
        let mut args: Vec<String> = Vec::new();

        args.push(task.source.clone());
        args.push(task.destination.clone());

        // Copy mode
        if opts.s { args.push("/S".into()); }
        if opts.e { args.push("/E".into()); }
        if opts.mir { args.push("/MIR".into()); }
        if opts.purge { args.push("/PURGE".into()); }
        if opts.mov { args.push("/MOV".into()); }
        if opts.move_ { args.push("/MOVE".into()); }
        if opts.create { args.push("/CREATE".into()); }

        // Copy flags
        if opts.z { args.push("/Z".into()); }
        if opts.b { args.push("/B".into()); }
        if opts.zb { args.push("/ZB".into()); }
        if opts.j { args.push("/J".into()); }
        if let Some(ref copy) = opts.copy { args.push(format!("/COPY:{}", copy)); }
        if let Some(ref dcopy) = opts.dcopy { args.push(format!("/DCOPY:{}", dcopy)); }
        if opts.sec { args.push("/SEC".into()); }
        if opts.copyall { args.push("/COPYALL".into()); }
        if opts.nodcopy { args.push("/NODCOPY".into()); }

        // Junctions
        if opts.sj { args.push("/SJ".into()); }
        if opts.xj { args.push("/XJ".into()); }

        // File selection
        if !opts.xd.is_empty() {
            args.push("/XD".into());
            for d in &opts.xd { args.push(d.clone()); }
        }
        if !opts.xf.is_empty() {
            args.push("/XF".into());
            for f in &opts.xf { args.push(f.clone()); }
        }
        if let Some(ref maxage) = opts.maxage { args.push(format!("/MAXAGE:{}", maxage)); }
        if let Some(ref minage) = opts.minage { args.push(format!("/MINAGE:{}", minage)); }
        if let Some(ref maxlad) = opts.maxlad { args.push(format!("/MAXLAD:{}", maxlad)); }
        if let Some(ref minlad) = opts.minlad { args.push(format!("/MINLAD:{}", minlad)); }
        if let Some(max) = opts.max { args.push(format!("/MAX:{}", max)); }
        if let Some(min) = opts.min { args.push(format!("/MIN:{}", min)); }

        // Performance
        if let Some(mt) = opts.mt { args.push(format!("/MT:{}", mt)); }
        if let Some(r) = opts.r { args.push(format!("/R:{}", r)); }
        if let Some(w) = opts.w { args.push(format!("/W:{}", w)); }

        // Log (always added)
        let log_path = resolve_log_path(task, log_directory);
        args.push(format!("/LOG:{}", log_path));

        // Output
        if opts.tee { args.push("/TEE".into()); }

        // Always-on flags for consistent behavior
        args.push("/BYTES".into());
        args.push("/ETA".into());

        args
    }

    #[cfg(windows)]
    pub fn spawn_robocopy(
        &self,
        task: &Task,
        log_directory: &str,
        run_id: i64,
    ) -> Result<(u32, Arc<Mutex<Child>>), String> {
        use std::os::windows::process::CommandExt;
        const CREATE_NEW_CONSOLE: u32 = 0x00000010;

        let args = Self::build_args(task, log_directory);
        let child = Command::new("robocopy")
            .args(&args)
            .creation_flags(CREATE_NEW_CONSOLE)
            .spawn()
            .map_err(|e| format!("Failed to spawn robocopy: {}", e))?;

        let pid = child.id();
        let child_arc = Arc::new(Mutex::new(child));

        let entry = RunningEntry {
            info: RunningTask {
                task_id: task.id.clone(),
                pid,
                run_id,
            },
            child: Arc::clone(&child_arc),
        };

        let mut running = self
            .running
            .lock()
            .map_err(|e| format!("Lock error: {}", e))?;
        running.insert(task.id.clone(), entry);

        Ok((pid, child_arc))
    }

    #[cfg(not(windows))]
    pub fn spawn_robocopy(
        &self,
        _task: &Task,
        _log_directory: &str,
        _run_id: i64,
    ) -> Result<(u32, Arc<Mutex<Child>>), String> {
        Err("Robocopy is only available on Windows".into())
    }

    pub fn get_running_tasks(&self) -> Vec<RunningTask> {
        let running = self.running.lock().unwrap_or_else(|e| e.into_inner());
        running.values().map(|e| e.info.clone()).collect()
    }

    pub fn is_task_running(&self, task_id: &str) -> bool {
        let running = self.running.lock().unwrap_or_else(|e| e.into_inner());
        running.contains_key(task_id)
    }

    pub fn remove_running(&self, task_id: &str) {
        let mut running = self.running.lock().unwrap_or_else(|e| e.into_inner());
        running.remove(task_id);
    }

    /// Poll-based wait that releases the child lock between checks,
    /// allowing `cancel_task` to kill the process via taskkill.
    pub fn wait_for_exit(child_handle: &Arc<Mutex<Child>>) -> i32 {
        loop {
            {
                let mut child = child_handle.lock().unwrap_or_else(|e| e.into_inner());
                match child.try_wait() {
                    Ok(Some(status)) => return status.code().unwrap_or(-3),
                    Ok(None) => {}
                    Err(_) => return -3,
                }
            } // lock released
            std::thread::sleep(std::time::Duration::from_millis(250));
        }
    }

    pub fn cancel_task(&self, task_id: &str) -> Result<(), String> {
        let pid = {
            let running = self.running.lock().map_err(|e| format!("Lock error: {}", e))?;
            let entry = running
                .get(task_id)
                .ok_or_else(|| format!("Task {} is not running", task_id))?;
            entry.info.pid
        };

        // Mark as cancelled before killing so the background thread knows
        {
            let mut cancelled = self.cancelled.lock().unwrap_or_else(|e| e.into_inner());
            cancelled.insert(task_id.to_string());
        }

        // Kill the entire process tree by PID — avoids needing the child lock
        Self::kill_process_tree(pid)
    }

    /// Returns true if the task was cancelled (and removes the flag).
    pub fn take_cancelled(&self, task_id: &str) -> bool {
        let mut cancelled = self.cancelled.lock().unwrap_or_else(|e| e.into_inner());
        cancelled.remove(task_id)
    }

    #[cfg(windows)]
    fn kill_process_tree(pid: u32) -> Result<(), String> {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;

        let status = Command::new("taskkill")
            .args(["/F", "/T", "/PID", &pid.to_string()])
            .creation_flags(CREATE_NO_WINDOW)
            .status()
            .map_err(|e| format!("Failed to run taskkill: {}", e))?;

        if status.success() {
            Ok(())
        } else {
            // taskkill may return non-zero if the process already exited
            Ok(())
        }
    }

    #[cfg(not(windows))]
    fn kill_process_tree(_pid: u32) -> Result<(), String> {
        Err("Process tree kill is only supported on Windows".into())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::RobocopyOptions;

    fn full_task() -> Task {
        Task {
            id: "task-1".into(),
            name: "C User Local".into(),
            source: "C:\\Users\\test".into(),
            destination: "J:\\backup\\test".into(),
            options: RobocopyOptions {
                s: true, e: false, mir: false, purge: false, mov: false, move_: false, create: false,
                z: false, b: false, zb: false, j: true,
                copy: None, dcopy: None, sec: false, copyall: false, nodcopy: false,
                sj: false, xj: true,
                xd: vec!["node_modules".into(), ".git".into()],
                xf: vec!["*.tmp".into()],
                maxage: None, minage: None, maxlad: None, minlad: None, max: None, min: None,
                mt: Some(64),
                r: Some(3), w: Some(5),
                tee: true, log: None,
            },
            group: None,
        }
    }

    fn minimal_task() -> Task {
        Task {
            id: "task-2".into(),
            name: "Simple Backup".into(),
            source: "C:\\Data".into(),
            destination: "D:\\Backup".into(),
            options: RobocopyOptions {
                s: true, e: false, mir: false, purge: false, mov: false, move_: false, create: false,
                z: false, b: false, zb: false, j: false,
                copy: None, dcopy: None, sec: false, copyall: false, nodcopy: false,
                sj: false, xj: false,
                xd: vec![], xf: vec![],
                maxage: None, minage: None, maxlad: None, minlad: None, max: None, min: None,
                mt: None, r: None, w: None,
                tee: false, log: None,
            },
            group: None,
        }
    }

    #[test]
    fn test_build_args_with_all_options() {
        let task = full_task();
        let args = ProcessManager::build_args(&task, "C:\\Logs");

        assert_eq!(args[0], "C:\\Users\\test");
        assert_eq!(args[1], "J:\\backup\\test");
        assert!(args.contains(&"/S".into()));
        assert!(args.contains(&"/J".into()));
        assert!(args.contains(&"/MT:64".into()));
        assert!(args.contains(&"/XJ".into()));
        assert!(args.contains(&"/R:3".into()));
        assert!(args.contains(&"/W:5".into()));
        assert!(args.contains(&"/XD".into()));
        assert!(args.contains(&"node_modules".into()));
        assert!(args.contains(&".git".into()));
        assert!(args.contains(&"/XF".into()));
        assert!(args.contains(&"*.tmp".into()));
        assert!(args.contains(&"/TEE".into()));
        assert!(!args.contains(&"/NP".into()));
        assert!(args.contains(&"/BYTES".into()));
        assert!(args.contains(&"/ETA".into()));
        assert!(args.contains(&"/LOG:C:\\Logs\\C-User-Local.log".into()));
        // /Z is no longer hardcoded — it's a user-toggleable option
        assert!(!args.contains(&"/Z".into()));
    }

    #[test]
    fn test_build_args_custom_log_path() {
        let mut task = full_task();
        task.options.log = Some("D:\\MyLogs\\custom.log".into());
        let args = ProcessManager::build_args(&task, "C:\\Logs");

        assert!(args.contains(&"/LOG:D:\\MyLogs\\custom.log".into()));
        // Ensure auto-generated path is NOT present
        assert!(!args.iter().any(|a| a.contains("C-User-Local")));
    }

    #[test]
    fn test_resolve_log_path_auto() {
        let task = full_task();
        let path = resolve_log_path(&task, "C:\\Logs");
        assert_eq!(path, "C:\\Logs\\C-User-Local.log");
    }

    #[test]
    fn test_resolve_log_path_custom() {
        let mut task = full_task();
        task.options.log = Some("D:\\MyLogs\\custom.log".into());
        let path = resolve_log_path(&task, "C:\\Logs");
        assert_eq!(path, "D:\\MyLogs\\custom.log");
    }

    #[test]
    fn test_build_args_no_optional_flags() {
        let task = minimal_task();
        let args = ProcessManager::build_args(&task, "C:\\Logs");

        assert_eq!(args[0], "C:\\Data");
        assert_eq!(args[1], "D:\\Backup");
        assert!(args.contains(&"/S".into()));
        assert!(!args.contains(&"/J".into()));
        assert!(!args.contains(&"/SJ".into()));
        assert!(!args.contains(&"/XJ".into()));
        assert!(!args.contains(&"/TEE".into()));
        assert!(!args.contains(&"/XD".into()));
        assert!(!args.contains(&"/XF".into()));
        assert!(!args.iter().any(|a| a.starts_with("/MT:")));
        assert!(!args.iter().any(|a| a.starts_with("/R:")));
        assert!(!args.iter().any(|a| a.starts_with("/W:")));
        assert!(!args.contains(&"/NP".into()));
        assert!(args.contains(&"/BYTES".into()));
        assert!(args.contains(&"/LOG:C:\\Logs\\Simple-Backup.log".into()));
    }

    #[test]
    fn test_running_task_tracking() {
        let pm = ProcessManager::new();
        assert!(pm.get_running_tasks().is_empty());
        assert!(!pm.is_task_running("task-1"));
    }
}
