import { confirm } from "@tauri-apps/plugin-dialog";
import { Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { LogEntry } from "../../lib/types";
import { commands } from "../../lib/commands";
import { formatBytes } from "../../lib/format";

const PAGE_SIZE = 100;

interface LogEntriesTableProps {
  runId: number;
}

export function LogEntriesTable({ runId }: LogEntriesTableProps) {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [counts, setCounts] = useState<[string, number][]>([]);
  const [selectedType, setSelectedType] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [removing, setRemoving] = useState<number | null>(null);

  useEffect(() => {
    commands.getLogEntryCounts(runId).then(setCounts).catch(console.error);
  }, [runId]);

  const loadEntries = useCallback(
    async (offset: number, type?: string) => {
      setLoading(true);
      try {
        const page = await commands.getLogEntries(runId, type, offset, PAGE_SIZE);
        if (offset === 0) {
          setEntries(page);
        } else {
          setEntries((prev) => [...prev, ...page]);
        }
        setHasMore(page.length === PAGE_SIZE);
      } catch (e) {
        console.error("Failed to load entries:", e);
      } finally {
        setLoading(false);
      }
    },
    [runId],
  );

  useEffect(() => {
    loadEntries(0, selectedType);
  }, [loadEntries, selectedType]);

  const handleRemove = async (entry: LogEntry) => {
    const isDir = entry.entry_type.includes("Dir");
    const kind = isDir ? "directory" : "file";
    const confirmed = await confirm(`Delete ${kind}?\n\n${entry.path}\n\nThis cannot be undone.`, {
      title: "Backup Gene",
      kind: "warning",
    });
    if (!confirmed) return;
    setRemoving(entry.id);
    try {
      await commands.removePath(entry.path);
      await commands.deleteLogEntry(entry.id);
      setEntries((prev) => prev.filter((e) => e.id !== entry.id));
      setCounts((prev) =>
        prev
          .map(([t, c]) => (t === entry.entry_type ? [t, c - 1] as [string, number] : [t, c] as [string, number]))
          .filter(([, c]) => c > 0),
      );
    } catch (e) {
      alert(`Failed to remove: ${e}`);
    } finally {
      setRemoving(null);
    }
  };

  const totalCount = counts.reduce((sum, [, c]) => sum + c, 0);

  return (
    <div className="mt-2 space-y-2">
      {/* Filter tabs */}
      <div className="flex flex-wrap gap-1">
        <button
          className={`px-2 py-0.5 rounded text-xs ${selectedType === undefined ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent/50"}`}
          onClick={() => setSelectedType(undefined)}
        >
          All ({totalCount})
        </button>
        {counts.map(([type, count]) => (
          <button
            key={type}
            className={`px-2 py-0.5 rounded text-xs ${selectedType === type ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent/50"}`}
            onClick={() => setSelectedType(type)}
          >
            {type} ({count})
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="text-xs">
        <div className="flex gap-2 px-1 py-1 font-medium text-muted-foreground border-b border-border">
          <span className="w-20 shrink-0">Type</span>
          <span className="w-20 shrink-0 text-right">Size</span>
          <span className="flex-1 min-w-0">Path</span>
          <span className="w-8 shrink-0"></span>
        </div>
        {entries.map((entry) => (
          <div key={entry.id} className="flex gap-2 px-1 py-0.5 hover:bg-accent/30 items-center">
            <span className="w-20 shrink-0 text-muted-foreground">{entry.entry_type}</span>
            <span className="w-20 shrink-0 text-right">{formatBytes(entry.size)}</span>
            <span className="flex-1 min-w-0 truncate" title={entry.path}>{entry.path}</span>
            <button
              className="w-8 shrink-0 flex items-center justify-center text-muted-foreground hover:text-red-500 disabled:opacity-30"
              onClick={() => handleRemove(entry)}
              disabled={removing === entry.id}
              title={`Remove ${entry.path}`}
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}
        {entries.length === 0 && !loading && (
          <div className="px-1 py-2 text-muted-foreground">No entries</div>
        )}
      </div>

      {/* Load more */}
      {hasMore && (
        <button
          className="text-xs text-muted-foreground hover:text-foreground px-1"
          onClick={() => loadEntries(entries.length, selectedType)}
          disabled={loading}
        >
          {loading ? "Loading..." : "Load more..."}
        </button>
      )}
    </div>
  );
}
