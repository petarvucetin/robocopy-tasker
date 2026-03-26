use crate::models::{Run, RunSummary};
use rusqlite::{params, Connection};
use std::sync::Mutex;

pub struct HistoryManager {
    conn: Mutex<Connection>,
}

fn map_row(row: &rusqlite::Row) -> rusqlite::Result<Run> {
    Ok(Run {
        id: row.get(0)?,
        task_id: row.get(1)?,
        task_name: row.get(2)?,
        started_at: row.get(3)?,
        finished_at: row.get(4)?,
        exit_code: row.get(5)?,
        summary: RunSummary {
            dirs_total: row.get(6)?,
            dirs_copied: row.get(7)?,
            dirs_skipped: row.get(8)?,
            dirs_failed: row.get(9)?,
            files_total: row.get(10)?,
            files_copied: row.get(11)?,
            files_skipped: row.get(12)?,
            files_failed: row.get(13)?,
            bytes_total: row.get(14)?,
            bytes_copied: row.get(15)?,
            speed_bytes_per_sec: row.get(16)?,
        },
    })
}

impl HistoryManager {
    pub fn new(db_path: &str) -> Result<Self, String> {
        let conn = Connection::open(db_path)
            .map_err(|e| format!("Failed to open database: {}", e))?;
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS runs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                task_id TEXT NOT NULL,
                task_name TEXT NOT NULL,
                started_at TEXT NOT NULL,
                finished_at TEXT,
                exit_code INTEGER,
                dirs_total INTEGER, dirs_copied INTEGER, dirs_skipped INTEGER, dirs_failed INTEGER,
                files_total INTEGER, files_copied INTEGER, files_skipped INTEGER, files_failed INTEGER,
                bytes_total INTEGER, bytes_copied INTEGER, speed_bytes_per_sec INTEGER
            )",
        )
        .map_err(|e| format!("Failed to create table: {}", e))?;
        Ok(Self {
            conn: Mutex::new(conn),
        })
    }

    pub fn insert_run(
        &self,
        task_id: &str,
        task_name: &str,
        started_at: &str,
    ) -> Result<i64, String> {
        let conn = self.conn.lock().map_err(|e| format!("Lock error: {}", e))?;
        conn.execute(
            "INSERT INTO runs (task_id, task_name, started_at) VALUES (?1, ?2, ?3)",
            params![task_id, task_name, started_at],
        )
        .map_err(|e| format!("Failed to insert run: {}", e))?;
        Ok(conn.last_insert_rowid())
    }

    pub fn complete_run(
        &self,
        run_id: i64,
        finished_at: &str,
        exit_code: i32,
        summary: &RunSummary,
    ) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| format!("Lock error: {}", e))?;
        conn.execute(
            "UPDATE runs SET finished_at = ?1, exit_code = ?2,
             dirs_total = ?3, dirs_copied = ?4, dirs_skipped = ?5, dirs_failed = ?6,
             files_total = ?7, files_copied = ?8, files_skipped = ?9, files_failed = ?10,
             bytes_total = ?11, bytes_copied = ?12, speed_bytes_per_sec = ?13
             WHERE id = ?14",
            params![
                finished_at,
                exit_code,
                summary.dirs_total,
                summary.dirs_copied,
                summary.dirs_skipped,
                summary.dirs_failed,
                summary.files_total,
                summary.files_copied,
                summary.files_skipped,
                summary.files_failed,
                summary.bytes_total,
                summary.bytes_copied,
                summary.speed_bytes_per_sec,
                run_id,
            ],
        )
        .map_err(|e| format!("Failed to complete run: {}", e))?;
        Ok(())
    }

    pub fn get_runs(
        &self,
        task_id: Option<&str>,
        limit: Option<u32>,
    ) -> Result<Vec<Run>, String> {
        let conn = self.conn.lock().map_err(|e| format!("Lock error: {}", e))?;
        let limit_val = limit.unwrap_or(100) as i64;

        match task_id {
            Some(tid) => {
                let mut stmt = conn
                    .prepare(
                        "SELECT id, task_id, task_name, started_at, finished_at, exit_code,
                         dirs_total, dirs_copied, dirs_skipped, dirs_failed,
                         files_total, files_copied, files_skipped, files_failed,
                         bytes_total, bytes_copied, speed_bytes_per_sec
                         FROM runs WHERE task_id = ?1 ORDER BY id DESC LIMIT ?2",
                    )
                    .map_err(|e| format!("Failed to prepare statement: {}", e))?;
                let rows = stmt
                    .query_map(params![tid, limit_val], |row| map_row(row))
                    .map_err(|e| format!("Failed to query runs: {}", e))?;
                rows.collect::<Result<Vec<_>, _>>()
                    .map_err(|e| format!("Failed to collect runs: {}", e))
            }
            None => {
                let mut stmt = conn
                    .prepare(
                        "SELECT id, task_id, task_name, started_at, finished_at, exit_code,
                         dirs_total, dirs_copied, dirs_skipped, dirs_failed,
                         files_total, files_copied, files_skipped, files_failed,
                         bytes_total, bytes_copied, speed_bytes_per_sec
                         FROM runs ORDER BY id DESC LIMIT ?1",
                    )
                    .map_err(|e| format!("Failed to prepare statement: {}", e))?;
                let rows = stmt
                    .query_map(params![limit_val], |row| map_row(row))
                    .map_err(|e| format!("Failed to query runs: {}", e))?;
                rows.collect::<Result<Vec<_>, _>>()
                    .map_err(|e| format!("Failed to collect runs: {}", e))
            }
        }
    }

    pub fn delete_run(&self, run_id: i64) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| format!("Lock error: {}", e))?;
        conn.execute("DELETE FROM runs WHERE id = ?1", params![run_id])
            .map_err(|e| format!("Failed to delete run: {}", e))?;
        Ok(())
    }

    pub fn cleanup_old_runs(&self, retention_days: u32) -> Result<u64, String> {
        let conn = self.conn.lock().map_err(|e| format!("Lock error: {}", e))?;
        let cutoff = chrono::Utc::now() - chrono::Duration::days(retention_days as i64);
        let cutoff_str = cutoff.format("%Y-%m-%dT%H:%M:%S").to_string();
        let deleted = conn
            .execute(
                "DELETE FROM runs WHERE started_at < ?1",
                params![cutoff_str],
            )
            .map_err(|e| format!("Failed to cleanup old runs: {}", e))?;
        Ok(deleted as u64)
    }

    pub fn mark_orphaned_runs(&self) -> Result<u64, String> {
        let conn = self.conn.lock().map_err(|e| format!("Lock error: {}", e))?;
        let updated = conn
            .execute(
                "UPDATE runs SET exit_code = -2 WHERE finished_at IS NULL",
                [],
            )
            .map_err(|e| format!("Failed to mark orphaned runs: {}", e))?;
        Ok(updated as u64)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_manager() -> HistoryManager {
        HistoryManager::new(":memory:").unwrap()
    }

    #[test]
    fn test_insert_and_complete_run() {
        let mgr = test_manager();
        let run_id = mgr
            .insert_run("task-1", "My Backup", "2025-01-01T10:00:00")
            .unwrap();
        assert_eq!(run_id, 1);

        let summary = RunSummary {
            dirs_total: Some(10),
            dirs_copied: Some(5),
            dirs_skipped: Some(5),
            dirs_failed: Some(0),
            files_total: Some(100),
            files_copied: Some(50),
            files_skipped: Some(50),
            files_failed: Some(0),
            bytes_total: Some(1024000),
            bytes_copied: Some(512000),
            speed_bytes_per_sec: Some(100000),
        };
        mgr.complete_run(run_id, "2025-01-01T10:05:00", 0, &summary)
            .unwrap();

        let runs = mgr.get_runs(Some("task-1"), None).unwrap();
        assert_eq!(runs.len(), 1);
        assert_eq!(runs[0].id, run_id);
        assert_eq!(runs[0].task_name, "My Backup");
        assert_eq!(runs[0].exit_code, Some(0));
        assert_eq!(runs[0].finished_at, Some("2025-01-01T10:05:00".into()));
        assert_eq!(runs[0].summary.files_total, Some(100));
        assert_eq!(runs[0].summary.files_copied, Some(50));
    }

    #[test]
    fn test_get_runs_filtered_by_task() {
        let mgr = test_manager();
        mgr.insert_run("task-1", "Backup A", "2025-01-01T10:00:00")
            .unwrap();
        mgr.insert_run("task-2", "Backup B", "2025-01-01T11:00:00")
            .unwrap();
        mgr.insert_run("task-1", "Backup A", "2025-01-01T12:00:00")
            .unwrap();

        let all_runs = mgr.get_runs(None, None).unwrap();
        assert_eq!(all_runs.len(), 3);

        let task1_runs = mgr.get_runs(Some("task-1"), None).unwrap();
        assert_eq!(task1_runs.len(), 2);
        for run in &task1_runs {
            assert_eq!(run.task_id, "task-1");
        }

        let task2_runs = mgr.get_runs(Some("task-2"), None).unwrap();
        assert_eq!(task2_runs.len(), 1);
        assert_eq!(task2_runs[0].task_name, "Backup B");

        // Verify newest first ordering
        assert!(task1_runs[0].id > task1_runs[1].id);
    }

    #[test]
    fn test_delete_run() {
        let mgr = test_manager();
        let run_id = mgr
            .insert_run("task-1", "Backup A", "2025-01-01T10:00:00")
            .unwrap();
        mgr.delete_run(run_id).unwrap();
        let runs = mgr.get_runs(None, None).unwrap();
        assert!(runs.is_empty());
    }

    #[test]
    fn test_mark_orphaned_runs() {
        let mgr = test_manager();
        // Insert two runs, complete only one
        let run1 = mgr
            .insert_run("task-1", "Backup A", "2025-01-01T10:00:00")
            .unwrap();
        let run2 = mgr
            .insert_run("task-2", "Backup B", "2025-01-01T11:00:00")
            .unwrap();

        let summary = RunSummary {
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
        mgr.complete_run(run1, "2025-01-01T10:05:00", 0, &summary)
            .unwrap();

        let orphaned = mgr.mark_orphaned_runs().unwrap();
        assert_eq!(orphaned, 1);

        let runs = mgr.get_runs(Some("task-2"), None).unwrap();
        assert_eq!(runs[0].id, run2);
        assert_eq!(runs[0].exit_code, Some(-2));
        assert!(runs[0].finished_at.is_none());

        // Verify the completed run was not affected
        let runs1 = mgr.get_runs(Some("task-1"), None).unwrap();
        assert_eq!(runs1[0].exit_code, Some(0));
    }
}
