use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RobocopyOptions {
    // Copy mode
    #[serde(default)]
    pub s: bool,
    #[serde(default)]
    pub e: bool,
    #[serde(default)]
    pub mir: bool,
    #[serde(default)]
    pub purge: bool,
    #[serde(default)]
    pub mov: bool,
    #[serde(default, rename = "move")]
    pub move_: bool,
    #[serde(default)]
    pub create: bool,
    // Copy flags
    #[serde(default)]
    pub z: bool,
    #[serde(default)]
    pub b: bool,
    #[serde(default)]
    pub zb: bool,
    #[serde(default)]
    pub j: bool,
    #[serde(default)]
    pub copy: Option<String>,
    #[serde(default)]
    pub dcopy: Option<String>,
    #[serde(default)]
    pub sec: bool,
    #[serde(default)]
    pub copyall: bool,
    #[serde(default)]
    pub nodcopy: bool,
    // Junctions
    #[serde(default)]
    pub sj: bool,
    #[serde(default)]
    pub xj: bool,
    // File selection
    #[serde(default)]
    pub xd: Vec<String>,
    #[serde(default)]
    pub xf: Vec<String>,
    #[serde(default)]
    pub maxage: Option<String>,
    #[serde(default)]
    pub minage: Option<String>,
    #[serde(default)]
    pub maxlad: Option<String>,
    #[serde(default)]
    pub minlad: Option<String>,
    #[serde(default)]
    pub max: Option<u64>,
    #[serde(default)]
    pub min: Option<u64>,
    // Performance
    #[serde(default)]
    pub mt: Option<u32>,
    #[serde(default)]
    pub r: Option<u32>,
    #[serde(default)]
    pub w: Option<u32>,
    // Output
    #[serde(default)]
    pub tee: bool,
    // Log (managed internally)
    #[serde(default)]
    pub log: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Task {
    pub id: String,
    pub name: String,
    pub source: String,
    pub destination: String,
    pub options: RobocopyOptions,
    #[serde(default)]
    pub group: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Group {
    pub id: String,
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Settings {
    #[serde(rename = "logDirectory")]
    pub log_directory: String,
    #[serde(rename = "historyRetentionDays")]
    pub history_retention_days: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub tasks: Vec<Task>,
    pub groups: Vec<Group>,
    pub settings: Settings,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            tasks: Vec::new(),
            groups: Vec::new(),
            settings: Settings {
                log_directory: String::new(),
                history_retention_days: 90,
            },
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RunSummary {
    pub dirs_total: Option<i64>,
    pub dirs_copied: Option<i64>,
    pub dirs_skipped: Option<i64>,
    pub dirs_failed: Option<i64>,
    pub files_total: Option<i64>,
    pub files_copied: Option<i64>,
    pub files_skipped: Option<i64>,
    pub files_failed: Option<i64>,
    pub bytes_total: Option<i64>,
    pub bytes_copied: Option<i64>,
    pub speed_bytes_per_sec: Option<i64>,
}

#[derive(Debug, Clone)]
pub struct ParsedEntry {
    pub entry_type: String,
    pub size: Option<i64>,
    pub path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogEntry {
    pub id: i64,
    pub run_id: i64,
    pub entry_type: String,
    pub size: Option<i64>,
    pub path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Run {
    pub id: i64,
    pub task_id: String,
    pub task_name: String,
    pub started_at: String,
    pub finished_at: Option<String>,
    pub exit_code: Option<i32>,
    #[serde(flatten)]
    pub summary: RunSummary,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RunningTask {
    pub task_id: String,
    pub pid: u32,
    pub run_id: i64,
}
