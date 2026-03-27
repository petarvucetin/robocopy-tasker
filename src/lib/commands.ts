import { invoke } from "@tauri-apps/api/core";
import type { AppConfig, Group, LogEntry, Run, RunningTask, Settings, Task } from "./types";

export const commands = {
  getConfig: () => invoke<AppConfig>("get_config"),
  saveTask: (task: Task) => invoke<AppConfig>("save_task", { task }),
  deleteTask: (taskId: string) => invoke<AppConfig>("delete_task", { taskId }),
  saveGroup: (group: Group) => invoke<AppConfig>("save_group", { group }),
  deleteGroup: (groupId: string) => invoke<AppConfig>("delete_group", { groupId }),
  updateSettings: (settings: Settings) => invoke<AppConfig>("update_settings", { settings }),
  runTask: (taskId: string) => invoke<number>("run_task", { taskId }),
  runGroup: (groupId: string) => invoke<number[]>("run_group", { groupId }),
  cancelTask: (taskId: string) => invoke<void>("cancel_task", { taskId }),
  getRunningTasks: () => invoke<RunningTask[]>("get_running_tasks"),
  getRuns: (taskId?: string, limit?: number) => invoke<Run[]>("get_runs", { taskId, limit }),
  deleteRun: (runId: number) => invoke<void>("delete_run", { runId }),
  cleanupOldRuns: (days?: number) => invoke<number>("cleanup_old_runs", { days }),
  getLogEntries: (runId: number, entryType?: string, offset?: number, limit?: number) =>
    invoke<LogEntry[]>("get_log_entries", { runId, entryType, offset, limit }),
  getLogEntryCounts: (runId: number) =>
    invoke<[string, number][]>("get_log_entry_counts", { runId }),
  removePath: (path: string) => invoke<void>("remove_path", { path }),
  deleteLogEntry: (entryId: number) => invoke<void>("delete_log_entry", { entryId }),
  resetHistory: () => invoke<void>("reset_history"),
};
