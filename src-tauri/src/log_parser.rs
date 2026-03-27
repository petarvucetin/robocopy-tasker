use crate::models::{ParsedEntry, RunSummary};
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

const ENTRY_TAGS: &[(&str, &str, bool)] = &[
    ("*EXTRA Dir", "Extra Dir", true),
    ("*EXTRA File", "Extra File", false),
    ("New File", "New File", false),
    ("New Dir", "New Dir", true),
    ("Newer", "Newer", false),
    ("Older", "Older", false),
    ("Modified", "Modified", false),
];

pub fn parse_entry_line(line: &str) -> Option<ParsedEntry> {
    let trimmed = line.trim();
    if let Some(error_entry) = parse_error_line(trimmed) {
        return Some(error_entry);
    }
    for &(tag, name, is_dir) in ENTRY_TAGS {
        if let Some(pos) = trimmed.find(tag) {
            let after_tag = trimmed[pos + tag.len()..].trim();
            if is_dir {
                if !after_tag.is_empty() {
                    return Some(ParsedEntry {
                        entry_type: name.to_string(),
                        size: None,
                        path: after_tag.to_string(),
                    });
                }
            } else {
                if let Some((size_str, path)) = split_size_and_path(after_tag) {
                    return Some(ParsedEntry {
                        entry_type: name.to_string(),
                        size: parse_size_value(&size_str),
                        path: path.to_string(),
                    });
                }
            }
        }
    }
    None
}

fn split_size_and_path(s: &str) -> Option<(String, String)> {
    let re = Regex::new(r"^(\d+)\s+(.+)$").ok()?;
    let caps = re.captures(s)?;
    Some((caps[1].to_string(), caps[2].trim().to_string()))
}

fn parse_error_line(line: &str) -> Option<ParsedEntry> {
    let re = Regex::new(r"^\d{4}/\d{2}/\d{2}\s+\d{2}:\d{2}:\d{2}\s+ERROR\s+\d+\s+\(0x[0-9a-fA-F]+\)\s+\w+\s+\w+\s+(.+)$").ok()?;
    let caps = re.captures(line)?;
    Some(ParsedEntry {
        entry_type: "Failed".to_string(),
        size: None,
        path: caps[1].trim().to_string(),
    })
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

pub fn parse_robocopy_log_full(path: &Path) -> (RunSummary, Vec<ParsedEntry>) {
    use std::io::{BufRead, BufReader};

    let empty_summary = RunSummary {
        dirs_total: None, dirs_copied: None, dirs_skipped: None, dirs_failed: None,
        files_total: None, files_copied: None, files_skipped: None, files_failed: None,
        bytes_total: None, bytes_copied: None, speed_bytes_per_sec: None,
    };

    let file = match fs::File::open(path) {
        Ok(f) => f,
        Err(_) => return (empty_summary, Vec::new()),
    };

    let reader = BufReader::new(file);
    let mut summary = empty_summary;
    let mut entries = Vec::new();

    for line_result in reader.lines() {
        let line = match line_result {
            Ok(l) => l,
            Err(_) => continue,
        };
        let trimmed = line.trim();

        // Parse summary lines (same logic as parse_robocopy_log)
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

        // Parse entry lines
        if let Some(entry) = parse_entry_line(&line) {
            entries.push(entry);
        }
    }

    (summary, entries)
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

    #[test]
    fn test_parse_entry_new_file() {
        let line = "\t  New File  \t\t       5678901\tC:\\Users\\petar\\Documents\\report.docx";
        let entry = parse_entry_line(line).unwrap();
        assert_eq!(entry.entry_type, "New File");
        assert_eq!(entry.size, Some(5678901));
        assert_eq!(entry.path, "C:\\Users\\petar\\Documents\\report.docx");
    }

    #[test]
    fn test_parse_entry_extra_dir() {
        let line = "\t*EXTRA Dir  \t\tJ:\\local-backup\\c-user-petar-backup\\old-archive\\";
        let entry = parse_entry_line(line).unwrap();
        assert_eq!(entry.entry_type, "Extra Dir");
        assert_eq!(entry.size, None);
        assert_eq!(entry.path, "J:\\local-backup\\c-user-petar-backup\\old-archive\\");
    }

    #[test]
    fn test_parse_entry_extra_file() {
        let line = "\t*EXTRA File\t\t          1234\tJ:\\local-backup\\deleted-notes.txt";
        let entry = parse_entry_line(line).unwrap();
        assert_eq!(entry.entry_type, "Extra File");
        assert_eq!(entry.size, Some(1234));
        assert_eq!(entry.path, "J:\\local-backup\\deleted-notes.txt");
    }

    #[test]
    fn test_parse_entry_newer() {
        let line = "\t    Newer   \t\t         90120\tC:\\Users\\petar\\Photos\\vacation.jpg";
        let entry = parse_entry_line(line).unwrap();
        assert_eq!(entry.entry_type, "Newer");
        assert_eq!(entry.size, Some(90120));
        assert_eq!(entry.path, "C:\\Users\\petar\\Photos\\vacation.jpg");
    }

    #[test]
    fn test_parse_entry_modified() {
        let line = "\t Modified   \t\t          4096\tC:\\Users\\petar\\.config\\settings.json";
        let entry = parse_entry_line(line).unwrap();
        assert_eq!(entry.entry_type, "Modified");
        assert_eq!(entry.size, Some(4096));
        assert_eq!(entry.path, "C:\\Users\\petar\\.config\\settings.json");
    }

    #[test]
    fn test_parse_entry_new_dir() {
        let line = "\t  New Dir   \t\tC:\\Users\\petar\\Projects\\new-project\\";
        let entry = parse_entry_line(line).unwrap();
        assert_eq!(entry.entry_type, "New Dir");
        assert_eq!(entry.size, None);
        assert_eq!(entry.path, "C:\\Users\\petar\\Projects\\new-project\\");
    }

    #[test]
    fn test_parse_entry_error_line() {
        let line = "2026/03/20 16:00:05 ERROR 5 (0x00000005) Copying File D:\\locked-file.dat";
        let entry = parse_entry_line(line).unwrap();
        assert_eq!(entry.entry_type, "Failed");
        assert_eq!(entry.size, None);
        assert_eq!(entry.path, "D:\\locked-file.dat");
    }

    #[test]
    fn test_parse_entry_ignores_summary_line() {
        let line = "   Files :       892       142       750         0         0         0";
        assert!(parse_entry_line(line).is_none());
    }

    #[test]
    fn test_parse_entry_ignores_header() {
        let line = "   ROBOCOPY     ::     Robust File Copy for Windows";
        assert!(parse_entry_line(line).is_none());
    }

    #[test]
    fn test_parse_entry_ignores_dashes() {
        let line = "------------------------------------------------------------------------------";
        assert!(parse_entry_line(line).is_none());
    }

    #[test]
    fn test_parse_full_success_log() {
        let (summary, entries) = parse_robocopy_log_full(&fixture_path("success.log"));
        assert_eq!(summary.dirs_total, Some(245));
        assert_eq!(summary.files_copied, Some(142));

        assert_eq!(entries.len(), 7);

        let types: Vec<&str> = entries.iter().map(|e| e.entry_type.as_str()).collect();
        assert!(types.contains(&"Extra Dir"));
        assert!(types.contains(&"Extra File"));
        assert!(types.contains(&"New File"));
        assert!(types.contains(&"New Dir"));
        assert!(types.contains(&"Newer"));
        assert!(types.contains(&"Modified"));

        let new_file = entries.iter().find(|e| e.path.contains("report.docx")).unwrap();
        assert_eq!(new_file.entry_type, "New File");
        assert_eq!(new_file.size, Some(5678901));
    }

    #[test]
    fn test_parse_full_partial_failure() {
        let (summary, entries) = parse_robocopy_log_full(&fixture_path("partial_failure.log"));
        assert_eq!(summary.files_failed, Some(3));

        assert_eq!(entries.len(), 4);

        let failed = entries.iter().find(|e| e.entry_type == "Failed").unwrap();
        assert_eq!(failed.path, "D:\\locked-file.dat");
    }

    #[test]
    fn test_parse_full_empty_log() {
        let (summary, entries) = parse_robocopy_log_full(&fixture_path("empty.log"));
        assert!(summary.files_total.is_none());
        assert!(entries.is_empty());
    }

    #[test]
    fn test_parse_full_missing_log() {
        let (summary, entries) = parse_robocopy_log_full(Path::new("nonexistent.log"));
        assert!(summary.files_total.is_none());
        assert!(entries.is_empty());
    }
}
