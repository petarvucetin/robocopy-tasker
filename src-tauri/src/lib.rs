pub mod config;
pub mod history;
pub mod log_parser;
pub mod models;
pub mod process;
pub mod validation;

use config::ConfigManager;
use history::HistoryManager;
use models::{AppConfig, Group, LogEntry, Run, RunSummary, RunningTask, Settings, Task};
use process::{resolve_log_path, ProcessManager};

use std::path::Path;
use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};
use tauri::{AppHandle, Emitter, Manager, State};

pub struct AppState {
    pub config: ConfigManager,
    pub history: HistoryManager,
    pub process: ProcessManager,
    pub pending_completions: AtomicUsize,
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
    state: State<'_, Arc<AppState>>,
    task_id: String,
) -> Result<(), String> {
    // Mark as cancelled and kill the process.
    // The background thread handles history recording and event emission.
    state.process.cancel_task(&task_id)?;
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
    days: u32,
) -> Result<u64, String> {
    state.history.cleanup_old_runs(days)
}

#[tauri::command]
fn get_log_entries(
    state: State<'_, Arc<AppState>>,
    run_id: i64,
    entry_type: Option<String>,
    offset: Option<u32>,
    limit: Option<u32>,
) -> Result<Vec<LogEntry>, String> {
    state.history.get_entries(
        run_id,
        entry_type.as_deref(),
        offset.unwrap_or(0),
        limit.unwrap_or(100),
    )
}

#[tauri::command]
fn get_log_entry_counts(
    state: State<'_, Arc<AppState>>,
    run_id: i64,
) -> Result<Vec<(String, i64)>, String> {
    state.history.get_entry_counts(run_id)
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
        // Poll-based wait — releases child lock between checks so cancel_task can kill
        let raw_exit_code = ProcessManager::wait_for_exit(&child_handle);

        // Signal that post-exit processing has started
        state_clone.pending_completions.fetch_add(1, Ordering::SeqCst);

        // Remove from running list
        state_clone.process.remove_running(&task_id);

        // Check if the task was cancelled — if so, override exit code to -1
        let was_cancelled = state_clone.process.take_cancelled(&task_id);
        let exit_code = if was_cancelled { -1 } else { raw_exit_code };

        // Resolve and parse log
        let log_path = resolve_log_path(&task_clone, &log_dir_owned);
        let (summary, entries) = if was_cancelled {
            (RunSummary {
                dirs_total: None, dirs_copied: None, dirs_skipped: None, dirs_failed: None,
                files_total: None, files_copied: None, files_skipped: None, files_failed: None,
                bytes_total: None, bytes_copied: None, speed_bytes_per_sec: None,
            }, Vec::new())
        } else {
            log_parser::parse_robocopy_log_full(Path::new(&log_path))
        };

        // Update history
        let finished_at = chrono::Utc::now().format("%Y-%m-%dT%H:%M:%S").to_string();
        let _ = state_clone
            .history
            .complete_run(run_id, &finished_at, exit_code, &summary);

        // Insert parsed entries
        let _ = state_clone.history.insert_entries(run_id, &entries);

        // Signal that post-exit processing is done
        state_clone.pending_completions.fetch_sub(1, Ordering::SeqCst);

        // Emit event to frontend
        let _ = app_handle.emit(
            "task-completed",
            serde_json::json!({
                "taskId": task_id,
                "runId": run_id,
                "exitCode": exit_code,
                "summary": null,
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
                pending_completions: AtomicUsize::new(0),
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
            get_log_entries,
            get_log_entry_counts,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            if let tauri::RunEvent::ExitRequested { api, .. } = &event {
                let state: State<'_, Arc<AppState>> = app_handle.state();
                let pending = state.pending_completions.load(Ordering::SeqCst);
                if pending > 0 {
                    api.prevent_exit();
                    let state_clone = Arc::clone(&*state);
                    std::thread::spawn(move || {
                        while state_clone.pending_completions.load(Ordering::SeqCst) > 0 {
                            std::thread::sleep(std::time::Duration::from_millis(100));
                        }
                        std::process::exit(0);
                    });
                }
            }
        });
}
