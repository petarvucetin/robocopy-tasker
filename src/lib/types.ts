export interface RobocopyOptions {
  s: boolean;
  j: boolean;
  sj: boolean;
  mt: number | null;
  xj: boolean;
  xjd: boolean;
  xjf: boolean;
  tee: boolean;
  r: number | null;
  w: number | null;
  xd: string[];
  xf: string[];
  log: string | null;
}

export interface Task {
  id: string;
  name: string;
  source: string;
  destination: string;
  options: RobocopyOptions;
  group: string | null;
}

export interface Group {
  id: string;
  name: string;
}

export interface Settings {
  logDirectory: string;
  historyRetentionDays: number;
}

export interface AppConfig {
  tasks: Task[];
  groups: Group[];
  settings: Settings;
}

export interface RunSummary {
  dirs_total: number | null;
  dirs_copied: number | null;
  dirs_skipped: number | null;
  dirs_failed: number | null;
  files_total: number | null;
  files_copied: number | null;
  files_skipped: number | null;
  files_failed: number | null;
  bytes_total: number | null;
  bytes_copied: number | null;
  speed_bytes_per_sec: number | null;
}

export interface Run {
  id: number;
  task_id: string;
  task_name: string;
  started_at: string;
  finished_at: string | null;
  exit_code: number | null;
  dirs_total: number | null;
  dirs_copied: number | null;
  dirs_skipped: number | null;
  dirs_failed: number | null;
  files_total: number | null;
  files_copied: number | null;
  files_skipped: number | null;
  files_failed: number | null;
  bytes_total: number | null;
  bytes_copied: number | null;
  speed_bytes_per_sec: number | null;
}

export interface LogEntry {
  id: number;
  run_id: number;
  entry_type: string;
  size: number | null;
  path: string;
}

export interface RunningTask {
  task_id: string;
  pid: number;
  run_id: number;
}

export interface TaskCompletedEvent {
  taskId: string;
  runId: number;
  exitCode: number;
  summary: RunSummary | null;
}

export const DEFAULT_OPTIONS: RobocopyOptions = {
  s: true, j: true, sj: false, mt: 64, xj: false,
  xjd: false, xjf: false, tee: true, r: null, w: null,
  xd: [], xf: [], log: null,
};
