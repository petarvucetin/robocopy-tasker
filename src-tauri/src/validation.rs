use crate::models::{RobocopyOptions, Task};

/// Check if a path is absolute: starts with drive letter (C:\) or UNC (\\)
pub fn is_absolute_path(path: &str) -> bool {
    let path = path.trim();
    if path.len() >= 3 {
        let bytes = path.as_bytes();
        if bytes[0].is_ascii_alphabetic() && bytes[1] == b':' && (bytes[2] == b'\\' || bytes[2] == b'/') {
            return true;
        }
    }
    if path.starts_with("\\\\") || path.starts_with("//") {
        return true;
    }
    false
}

/// Check filename portion for illegal NTFS characters: < > : " | ? *
pub fn has_illegal_ntfs_chars(filename: &str) -> bool {
    filename.chars().any(|c| matches!(c, '<' | '>' | '"' | '|' | '?' | '*'))
}

/// Extract filename from a full path
fn filename_from_path(path: &str) -> &str {
    path.split(['\\', '/']).last().unwrap_or(path)
}

pub fn validate_task(task: &Task) -> Result<(), String> {
    if task.name.trim().is_empty() {
        return Err("Task name cannot be empty".into());
    }
    if !is_absolute_path(&task.source) {
        return Err(format!("Source path must be absolute: {}", task.source));
    }
    if !is_absolute_path(&task.destination) {
        return Err(format!("Destination path must be absolute: {}", task.destination));
    }
    validate_options(&task.options)?;
    Ok(())
}

pub fn validate_options(opts: &RobocopyOptions) -> Result<(), String> {
    if let Some(mt) = opts.mt {
        if mt < 1 || mt > 128 {
            return Err(format!("/mt must be 1-128, got {}", mt));
        }
    }
    for entry in &opts.xd {
        if entry.trim().is_empty() {
            return Err("Exclude directory entries cannot be empty".into());
        }
    }
    for entry in &opts.xf {
        if entry.trim().is_empty() {
            return Err("Exclude file entries cannot be empty".into());
        }
    }
    if let Some(ref log_path) = opts.log {
        if !is_absolute_path(log_path) {
            return Err(format!("Log path must be absolute: {}", log_path));
        }
        let fname = filename_from_path(log_path);
        if has_illegal_ntfs_chars(fname) {
            return Err(format!("Log filename contains illegal characters: {}", fname));
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_absolute_path_drive_letter() {
        assert!(is_absolute_path("C:\\Users\\petar"));
        assert!(is_absolute_path("D:\\"));
        assert!(is_absolute_path("J:\\local-backup\\test"));
    }

    #[test]
    fn test_absolute_path_unc() {
        assert!(is_absolute_path("\\\\192.168.1.7\\tank backup\\d-backup"));
        assert!(is_absolute_path("\\\\wsl.localhost\\Ubuntu\\home\\petar"));
    }

    #[test]
    fn test_relative_path_rejected() {
        assert!(!is_absolute_path("robocopy-backup-logs/test.log"));
        assert!(!is_absolute_path("../logs/test.log"));
        assert!(!is_absolute_path("test.log"));
    }

    #[test]
    fn test_illegal_ntfs_chars() {
        assert!(has_illegal_ntfs_chars("file<name>.log"));
        assert!(has_illegal_ntfs_chars("file|name.log"));
        assert!(has_illegal_ntfs_chars("file?.log"));
        assert!(!has_illegal_ntfs_chars("normal-file_name.log"));
        assert!(!has_illegal_ntfs_chars("file with spaces.log"));
    }

    #[test]
    fn test_mt_range_validation() {
        let mut opts = RobocopyOptions {
            s: false, j: false, sj: false, mt: Some(0), xj: false,
            xjd: false, xjf: false, tee: false, r: None, w: None,
            xd: vec![], xf: vec![], log: None,
        };
        assert!(validate_options(&opts).is_err());
        opts.mt = Some(129);
        assert!(validate_options(&opts).is_err());
        opts.mt = Some(128);
        assert!(validate_options(&opts).is_ok());
        opts.mt = Some(1);
        assert!(validate_options(&opts).is_ok());
    }

    #[test]
    fn test_log_path_must_be_absolute() {
        let mut opts = RobocopyOptions {
            s: false, j: false, sj: false, mt: None, xj: false,
            xjd: false, xjf: false, tee: false, r: None, w: None,
            xd: vec![], xf: vec![], log: Some("relative/path.log".into()),
        };
        assert!(validate_options(&opts).is_err());
        opts.log = Some("C:\\logs\\backup.log".into());
        assert!(validate_options(&opts).is_ok());
    }

    #[test]
    fn test_empty_xd_entry_rejected() {
        let opts = RobocopyOptions {
            s: false, j: false, sj: false, mt: None, xj: false,
            xjd: false, xjf: false, tee: false, r: None, w: None,
            xd: vec!["".into()], xf: vec![], log: None,
        };
        assert!(validate_options(&opts).is_err());
    }
}
