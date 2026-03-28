use crate::models::{AppConfig, Group, Settings, Task};
use crate::validation::validate_task;
use std::fs;
use std::path::PathBuf;

pub struct ConfigManager {
    config_path: PathBuf,
}

impl ConfigManager {
    pub fn new(app_data_dir: PathBuf) -> Self {
        fs::create_dir_all(&app_data_dir).ok();
        Self {
            config_path: app_data_dir.join("config.json"),
        }
    }

    pub fn load(&self) -> AppConfig {
        match fs::read_to_string(&self.config_path) {
            Ok(contents) => match serde_json::from_str(&contents) {
                Ok(config) => config,
                Err(_) => {
                    let backup = self.config_path.with_extension("json.bak");
                    fs::copy(&self.config_path, &backup).ok();
                    AppConfig::default()
                }
            },
            Err(_) => AppConfig::default(),
        }
    }

    pub fn save(&self, config: &AppConfig) -> Result<(), String> {
        let json = serde_json::to_string_pretty(config)
            .map_err(|e| format!("Failed to serialize config: {}", e))?;
        fs::write(&self.config_path, json)
            .map_err(|e| format!("Failed to write config: {}", e))?;
        Ok(())
    }

    pub fn save_task(&self, task: Task) -> Result<AppConfig, String> {
        validate_task(&task)?;
        let mut config = self.load();
        if let Some(existing) = config.tasks.iter_mut().find(|t| t.id == task.id) {
            *existing = task;
        } else {
            config.tasks.push(task);
        }
        self.save(&config)?;
        Ok(config)
    }

    pub fn delete_task(&self, task_id: &str) -> Result<AppConfig, String> {
        let mut config = self.load();
        config.tasks.retain(|t| t.id != task_id);
        self.save(&config)?;
        Ok(config)
    }

    pub fn save_group(&self, group: Group) -> Result<AppConfig, String> {
        let mut config = self.load();
        if let Some(existing) = config.groups.iter_mut().find(|g| g.id == group.id) {
            *existing = group;
        } else {
            config.groups.push(group);
        }
        self.save(&config)?;
        Ok(config)
    }

    pub fn delete_group(&self, group_id: &str) -> Result<AppConfig, String> {
        let mut config = self.load();
        config.groups.retain(|g| g.id != group_id);
        for task in config.tasks.iter_mut() {
            if task.group.as_deref() == Some(group_id) {
                task.group = None;
            }
        }
        self.save(&config)?;
        Ok(config)
    }

    pub fn update_settings(&self, settings: Settings) -> Result<AppConfig, String> {
        let mut config = self.load();
        config.settings = settings;
        self.save(&config)?;
        Ok(config)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::RobocopyOptions;

    fn test_config_manager() -> (ConfigManager, tempfile::TempDir) {
        let tmp = tempfile::tempdir().unwrap();
        let mgr = ConfigManager::new(tmp.path().to_path_buf());
        (mgr, tmp)
    }

    fn sample_task(id: &str) -> Task {
        Task {
            id: id.into(),
            name: "Test Task".into(),
            source: "C:\\Users\\test".into(),
            destination: "J:\\backup\\test".into(),
            options: RobocopyOptions {
                s: true, e: false, mir: false, purge: false, mov: false, move_: false, create: false,
                z: false, b: false, zb: false, j: true,
                copy: None, dcopy: None, sec: false, copyall: false, nodcopy: false,
                sj: false, xj: false,
                xd: vec![], xf: vec![],
                maxage: None, minage: None, maxlad: None, minlad: None, max: None, min: None,
                mt: Some(16), r: None, w: None,
                tee: true, log: None,
            },
            group: None,
        }
    }

    #[test]
    fn test_load_returns_default_when_no_file() {
        let (mgr, _tmp) = test_config_manager();
        let config = mgr.load();
        assert!(config.tasks.is_empty());
        assert_eq!(config.settings.history_retention_days, 90);
    }

    #[test]
    fn test_save_and_load_task() {
        let (mgr, _tmp) = test_config_manager();
        let task = sample_task("t1");
        mgr.save_task(task.clone()).unwrap();
        let config = mgr.load();
        assert_eq!(config.tasks.len(), 1);
        assert_eq!(config.tasks[0].name, "Test Task");
    }

    #[test]
    fn test_update_existing_task() {
        let (mgr, _tmp) = test_config_manager();
        mgr.save_task(sample_task("t1")).unwrap();
        let mut updated = sample_task("t1");
        updated.name = "Updated".into();
        mgr.save_task(updated).unwrap();
        let config = mgr.load();
        assert_eq!(config.tasks.len(), 1);
        assert_eq!(config.tasks[0].name, "Updated");
    }

    #[test]
    fn test_delete_task() {
        let (mgr, _tmp) = test_config_manager();
        mgr.save_task(sample_task("t1")).unwrap();
        mgr.delete_task("t1").unwrap();
        let config = mgr.load();
        assert!(config.tasks.is_empty());
    }

    #[test]
    fn test_rejects_invalid_task() {
        let (mgr, _tmp) = test_config_manager();
        let mut task = sample_task("t1");
        task.source = "relative/path".into();
        assert!(mgr.save_task(task).is_err());
    }

    #[test]
    fn test_corrupted_config_backed_up() {
        let (mgr, _tmp) = test_config_manager();
        fs::write(&mgr.config_path, "not valid json!!!").unwrap();
        let config = mgr.load();
        assert!(config.tasks.is_empty());
        assert!(mgr.config_path.with_extension("json.bak").exists());
    }

    #[test]
    fn test_delete_group_unassigns_tasks() {
        let (mgr, _tmp) = test_config_manager();
        let mut task = sample_task("t1");
        task.group = Some("g1".into());
        mgr.save_task(task).unwrap();
        mgr.save_group(Group { id: "g1".into(), name: "Group 1".into() }).unwrap();
        mgr.delete_group("g1").unwrap();
        let config = mgr.load();
        assert!(config.groups.is_empty());
        assert!(config.tasks[0].group.is_none());
    }
}
