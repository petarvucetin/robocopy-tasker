export interface RobocopyOptions {
  // Copy mode
  s: boolean;          // /S  — Subdirectories (skip empty)
  e: boolean;          // /E  — Subdirectories (include empty)
  mir: boolean;        // /MIR — Mirror (/E + /PURGE)
  purge: boolean;      // /PURGE — Delete dest files not in source
  mov: boolean;        // /MOV — Move files (delete from source)
  move: boolean;       // /MOVE — Move files and dirs
  create: boolean;     // /CREATE — Create dir tree + zero-length files only
  // Copy flags
  z: boolean;          // /Z  — Restartable mode
  b: boolean;          // /B  — Backup mode (uses BackupSemantics)
  zb: boolean;         // /ZB — Restartable with backup fallback
  j: boolean;          // /J  — Unbuffered I/O (large files)
  copy: string | null; // /COPY:flags — e.g. "DATSOU"
  dcopy: string | null;// /DCOPY:flags — e.g. "DAT"
  sec: boolean;        // /SEC — Copy with security (equiv /COPY:DATS)
  copyall: boolean;    // /COPYALL — Copy all file info (equiv /COPY:DATSOU)
  nodcopy: boolean;    // /NODCOPY — Copy no directory info
  // Junctions
  sj: boolean;         // /SJ — Copy junctions as junctions
  xj: boolean;         // /XJ — Exclude junction points
  // File selection
  xd: string[];        // /XD — Exclude directories
  xf: string[];        // /XF — Exclude files
  maxage: string | null;  // /MAXAGE:n — Max file age (days or YYYYMMDD)
  minage: string | null;  // /MINAGE:n — Min file age
  maxlad: string | null;  // /MAXLAD:n — Max last access date
  minlad: string | null;  // /MINLAD:n — Min last access date
  max: number | null;     // /MAX:n — Max file size (bytes)
  min: number | null;     // /MIN:n — Min file size (bytes)
  // Performance
  mt: number | null;   // /MT:n — Multithreading (1-128)
  r: number | null;    // /R:n — Retry count
  w: number | null;    // /W:n — Wait between retries (seconds)
  // Output
  tee: boolean;        // /TEE — Console + log output
  // Log (managed internally, not shown in UI)
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
  s: true, e: false, mir: false, purge: false, mov: false, move: false, create: false,
  z: false, b: false, zb: false, j: true,
  copy: null, dcopy: null, sec: false, copyall: false, nodcopy: false,
  sj: false, xj: false,
  xd: [], xf: [],
  maxage: null, minage: null, maxlad: null, minlad: null, max: null, min: null,
  mt: 16, r: null, w: null,
  tee: true, log: null,
};
