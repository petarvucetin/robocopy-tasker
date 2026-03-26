use crate::models::RunSummary;
use regex::Regex;
use std::fs;
use std::path::Path;

fn parse_size_value(s: &str) -> Option<i64> {
    let s = s.trim().to_lowercase();
    if s == "0" {
        return Some(0);
    }
    if let Ok(v) = s.parse::<i64>() {
        return Some(v);
    }
    let re = Regex::new(r"^([\d.]+)\s*([kmgt]?)$").ok()?;
    let caps = re.captures(&s)?;
    let num: f64 = caps[1].parse().ok()?;
    let multiplier: f64 = match caps.get(2).map(|m| m.as_str()) {
        Some("k") => 1024.0,
        Some("m") => 1024.0 * 1024.0,
        Some("g") => 1024.0 * 1024.0 * 1024.0,
        Some("t") => 1024.0 * 1024.0 * 1024.0 * 1024.0,
        _ => 1.0,
    };
    Some((num * multiplier) as i64)
}

fn parse_summary_line(line: &str) -> Option<(i64, i64, i64, i64)> {
    let re = Regex::new(r"(?i)(dirs|files|bytes)\s*:\s*(.+)").ok()?;
    let caps = re.captures(line)?;
    let values_str = caps[2].trim();
    let parts: Vec<&str> = values_str.split_whitespace().collect();
    if parts.len() < 5 {
        return None;
    }
    let category = caps[1].to_lowercase();
    if category == "bytes" {
        let mut values = Vec::new();
        let mut i = 0;
        while i < parts.len() {
            if i + 1 < parts.len() && ["k", "m", "g", "t"].contains(&parts[i + 1].to_lowercase().as_str()) {
                let combined = format!("{} {}", parts[i], parts[i + 1]);
                values.push(parse_size_value(&combined).unwrap_or(0));
                i += 2;
            } else {
                values.push(parse_size_value(parts[i]).unwrap_or(0));
                i += 1;
            }
        }
        if values.len() >= 5 {
            return Some((values[0], values[1], values[2], values[4]));
        }
        return None;
    }
    let total = parts[0].parse().ok()?;
    let copied = parts[1].parse().ok()?;
    let skipped = parts[2].parse().ok()?;
    let failed = parts[4].parse().ok()?;
    Some((total, copied, skipped, failed))
}

pub fn parse_robocopy_log(path: &Path) -> RunSummary {
    let empty = RunSummary {
        dirs_total: None, dirs_copied: None, dirs_skipped: None, dirs_failed: None,
        files_total: None, files_copied: None, files_skipped: None, files_failed: None,
        bytes_total: None, bytes_copied: None, speed_bytes_per_sec: None,
    };
    let contents = match fs::read_to_string(path) {
        Ok(c) => c,
        Err(_) => return empty,
    };
    if contents.trim().is_empty() {
        return empty;
    }
    let mut summary = empty;
    for line in contents.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("Dirs :") || trimmed.starts_with("Dirs:") {
            if let Some((total, copied, skipped, failed)) = parse_summary_line(trimmed) {
                summary.dirs_total = Some(total);
                summary.dirs_copied = Some(copied);
                summary.dirs_skipped = Some(skipped);
                summary.dirs_failed = Some(failed);
            }
        }
        if trimmed.starts_with("Files :") || trimmed.starts_with("Files:") {
            if let Some((total, copied, skipped, failed)) = parse_summary_line(trimmed) {
                summary.files_total = Some(total);
                summary.files_copied = Some(copied);
                summary.files_skipped = Some(skipped);
                summary.files_failed = Some(failed);
            }
        }
        if trimmed.starts_with("Bytes :") || trimmed.starts_with("Bytes:") {
            if let Some((total, copied, _skipped, _failed)) = parse_summary_line(trimmed) {
                summary.bytes_total = Some(total);
                summary.bytes_copied = Some(copied);
            }
        }
        if trimmed.contains("Bytes/sec") {
            let speed_re = Regex::new(r"([\d]+)\s*Bytes/sec").ok();
            if let Some(re) = speed_re {
                if let Some(caps) = re.captures(trimmed) {
                    summary.speed_bytes_per_sec = caps[1].parse().ok();
                }
            }
        }
    }
    summary
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    fn fixture_path(name: &str) -> PathBuf {
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("tests")
            .join("fixtures")
            .join(name)
    }

    #[test]
    fn test_parse_success_log() {
        let summary = parse_robocopy_log(&fixture_path("success.log"));
        assert_eq!(summary.dirs_total, Some(245));
        assert_eq!(summary.dirs_copied, Some(12));
        assert_eq!(summary.dirs_skipped, Some(233));
        assert_eq!(summary.dirs_failed, Some(0));
        assert_eq!(summary.files_total, Some(892));
        assert_eq!(summary.files_copied, Some(142));
        assert_eq!(summary.files_skipped, Some(750));
        assert_eq!(summary.files_failed, Some(0));
        assert!(summary.bytes_total.unwrap() > 0);
        assert!(summary.bytes_copied.unwrap() > 0);
        assert_eq!(summary.speed_bytes_per_sec, Some(145235000));
    }

    #[test]
    fn test_parse_up_to_date_log() {
        let summary = parse_robocopy_log(&fixture_path("up_to_date.log"));
        assert_eq!(summary.files_copied, Some(0));
        assert_eq!(summary.files_total, Some(892));
        assert_eq!(summary.speed_bytes_per_sec, Some(0));
    }

    #[test]
    fn test_parse_partial_failure_log() {
        let summary = parse_robocopy_log(&fixture_path("partial_failure.log"));
        assert_eq!(summary.files_copied, Some(201));
        assert_eq!(summary.files_failed, Some(3));
        assert_eq!(summary.files_total, Some(1500));
    }

    #[test]
    fn test_parse_fatal_log() {
        let summary = parse_robocopy_log(&fixture_path("fatal.log"));
        assert!(summary.files_total.is_none());
        assert!(summary.dirs_total.is_none());
    }

    #[test]
    fn test_parse_empty_log() {
        let summary = parse_robocopy_log(&fixture_path("empty.log"));
        assert!(summary.files_total.is_none());
    }

    #[test]
    fn test_parse_missing_log() {
        let summary = parse_robocopy_log(Path::new("nonexistent.log"));
        assert!(summary.files_total.is_none());
    }
}
