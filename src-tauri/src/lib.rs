pub mod config;
pub mod history;
pub mod log_parser;
pub mod models;
pub mod process;
pub mod validation;

use config::ConfigManager;
use history::HistoryManager;
use models::{AppConfig, Group, Run, RunSummary, RunningTask, Settings, Task};
use process::{resolve_log_path, ProcessManager};

use std::path::Path;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager, State};

pub struct AppState {
    pub config: ConfigManager,
    pub history: HistoryManager,
    pub process: ProcessManager,
}

// ---------------------------------------------------------------------------
// Tauri commands
// ---------------------------------------------------------------------------

#[tauri::command]
fn get_config(state: State<'_, Arc<AppState>>) -> Result<AppConfig, String> {
    Ok(state.config.load())
}

#[tauri::command]
fn save_task(state: State<'_, Arc<AppState>>, task: Task) -> Result<AppConfig, String> {
    state.config.save_task(task)
}

#[tauri::command]
fn delete_task(state: State<'_, Arc<AppState>>, task_id: String) -> Result<AppConfig, String> {
    state.config.delete_task(&task_id)
}

#[tauri::command]
fn save_group(state: State<'_, Arc<AppState>>, group: Group) -> Result<AppConfig, String> {
    state.config.save_group(group)
}

#[tauri::command]
fn delete_group(state: State<'_, Arc<AppState>>, group_id: String) -> Result<AppConfig, String> {
    state.config.delete_group(&group_id)
}

#[tauri::command]
fn update_settings(
    state: State<'_, Arc<AppState>>,
    settings: Settings,
) -> Result<AppConfig, String> {
    state.config.update_settings(settings)
}

#[tauri::command]
fn run_task(
    app: AppHandle,
    state: State<'_, Arc<AppState>>,
    task_id: String,
) -> Result<u32, String> {
    let config = state.config.load();
    let task = config
        .tasks
        .iter()
        .find(|t| t.id == task_id)
        .ok_or_else(|| format!("Task not found: {}", task_id))?
        .clone();

    let log_dir = config.settings.log_directory.clone();
    let state_arc = Arc::clone(&*state);

    let pid = spawn_single_task(&app, &state_arc, &task, &log_dir)?;
    Ok(pid)
}

#[tauri::command]
fn run_group(
    app: AppHandle,
    state: State<'_, Arc<AppState>>,
    group_id: String,
) -> Result<Vec<u32>, String> {
    let config = state.config.load();
    let tasks: Vec<Task> = config
        .tasks
        .iter()
        .filter(|t| t.group.as_deref() == Some(&group_id))
        .cloned()
        .collect();

    if tasks.is_empty() {
        return Err(format!("No tasks found in group: {}", group_id));
    }

    let log_dir = config.settings.log_directory.clone();
    let state_arc = Arc::clone(&*state);
    let mut pids = Vec::new();
    let mut errors = Vec::new();

    for task in &tasks {
        match spawn_single_task(&app, &state_arc, task, &log_dir) {
            Ok(pid) => pids.push(pid),
            Err(e) => errors.push(format!("{}: {}", task.name, e)),
        }
    }

    if pids.is_empty() && !errors.is_empty() {
        return Err(format!("All tasks failed: {}", errors.join("; ")));
    }

    Ok(pids)
}

#[tauri::command]
fn cancel_task(
    app: AppHandle,
    state: State<'_, Arc<AppState>>,
    task_id: String,
) -> Result<(), String> {
    // Kill the process
    state.process.cancel_task(&task_id)?;

    // Get the running task info before removing it
    let running_tasks = state.process.get_running_tasks();
    let running = running_tasks
        .iter()
        .find(|r| r.task_id == task_id)
        .cloned();

    // Remove from running list
    state.process.remove_running(&task_id);

    // Record cancelled exit code (-1) in history
    if let Some(info) = running {
        let finished_at = chrono::Utc::now().format("%Y-%m-%dT%H:%M:%S").to_string();
        let empty_summary = RunSummary {
            dirs_total: None,
            dirs_copied: None,
            dirs_skipped: None,
            dirs_failed: None,
            files_total: None,
            files_copied: None,
            files_skipped: None,
            files_failed: None,
            bytes_total: None,
            bytes_copied: None,
            speed_bytes_per_sec: None,
        };
        let _ = state
            .history
            .complete_run(info.run_id, &finished_at, -1, &empty_summary);

        // Emit task-completed event
        let _ = app.emit(
            "task-completed",
            serde_json::json!({
                "task_id": task_id,
                "run_id": info.run_id,
                "exit_code": -1,
            }),
        );
    }

    Ok(())
}

#[tauri::command]
fn get_running_tasks(state: State<'_, Arc<AppState>>) -> Vec<RunningTask> {
    state.process.get_running_tasks()
}

#[tauri::command]
fn get_runs(
    state: State<'_, Arc<AppState>>,
    task_id: Option<String>,
    limit: Option<u32>,
) -> Result<Vec<Run>, String> {
    state.history.get_runs(task_id.as_deref(), limit)
}

#[tauri::command]
fn delete_run(state: State<'_, Arc<AppState>>, run_id: i64) -> Result<(), String> {
    state.history.delete_run(run_id)
}

#[tauri::command]
fn cleanup_old_runs(
    state: State<'_, Arc<AppState>>,
    retention_days: u32,
) -> Result<u64, String> {
    state.history.cleanup_old_runs(retention_days)
}

// ---------------------------------------------------------------------------
// Private helper
// ---------------------------------------------------------------------------

/// Shared logic for spawning a single robocopy task.
/// Used by both `run_task` and `run_group`.
fn spawn_single_task(
    app: &AppHandle,
    state: &Arc<AppState>,
    task: &Task,
    log_directory: &str,
) -> Result<u32, String> {
    // Check if task is already running
    if state.process.is_task_running(&task.id) {
        return Err(format!("Task {} is already running", task.name));
    }

    // Source path must exist
    if !Path::new(&task.source).exists() {
        return Err(format!("Source path does not exist: {}", task.source));
    }

    // Auto-create destination if missing
    if !Path::new(&task.destination).exists() {
        std::fs::create_dir_all(&task.destination)
            .map_err(|e| format!("Failed to create destination: {}", e))?;
    }

    // Auto-create log directory if missing
    if !log_directory.is_empty() && !Path::new(log_directory).exists() {
        std::fs::create_dir_all(log_directory)
            .map_err(|e| format!("Failed to create log directory: {}", e))?;
    }

    // Insert run record
    let started_at = chrono::Utc::now().format("%Y-%m-%dT%H:%M:%S").to_string();
    let run_id = state
        .history
        .insert_run(&task.id, &task.name, &started_at)?;

    // Spawn robocopy
    let (pid, child_handle) = state.process.spawn_robocopy(task, log_directory, run_id)?;

    // Clone what the background thread needs
    let app_handle = app.clone();
    let state_clone = Arc::clone(state);
    let task_id = task.id.clone();
    let task_clone = task.clone();
    let log_dir_owned = log_directory.to_string();

    // Background thread: wait for process exit, parse log, update history, emit event
    std::thread::spawn(move || {
        let exit_code = {
            let mut child = child_handle.lock().unwrap();
            match child.wait() {
                Ok(status) => status.code().unwrap_or(-1),
                Err(_) => -1,
            }
        };

        // Remove from running list
        state_clone.process.remove_running(&task_id);

        // Resolve and parse log
        let log_path = resolve_log_path(&task_clone, &log_dir_owned);
        let summary = log_parser::parse_robocopy_log(Path::new(&log_path));

        // Update history
        let finished_at = chrono::Utc::now().format("%Y-%m-%dT%H:%M:%S").to_string();
        let _ = state_clone
            .history
            .complete_run(run_id, &finished_at, exit_code, &summary);

        // Emit event to frontend
        let _ = app_handle.emit(
            "task-completed",
            serde_json::json!({
                "task_id": task_id,
                "run_id": run_id,
                "exit_code": exit_code,
            }),
        );
    });

    Ok(pid)
}

// ---------------------------------------------------------------------------
// Tauri app setup
// ---------------------------------------------------------------------------

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("Failed to resolve app data directory");

            let config_mgr = ConfigManager::new(app_data_dir.clone());

            let db_path = app_data_dir.join("history.db");
            let history_mgr = HistoryManager::new(
                db_path
                    .to_str()
                    .expect("Invalid database path"),
            )
            .expect("Failed to initialise history database");

            let process_mgr = ProcessManager::new();

            // Mark any runs that were in-progress when the app last closed
            let _ = history_mgr.mark_orphaned_runs();

            // Clean up old runs based on configured retention
            let config = config_mgr.load();
            let _ = history_mgr.cleanup_old_runs(config.settings.history_retention_days);

            // Ensure the log directory exists
            let log_dir = &config.settings.log_directory;
            if !log_dir.is_empty() {
                std::fs::create_dir_all(log_dir).ok();
            }

            let state = Arc::new(AppState {
                config: config_mgr,
                history: history_mgr,
                process: process_mgr,
            });

            app.manage(state);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_config,
            save_task,
            delete_task,
            save_group,
            delete_group,
            update_settings,
            run_task,
            run_group,
            cancel_task,
            get_running_tasks,
            get_runs,
            delete_run,
            cleanup_old_runs,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
