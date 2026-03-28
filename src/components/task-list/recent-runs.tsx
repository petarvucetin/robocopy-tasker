import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import type { Run } from "../../lib/types";
import { getExitColor, getExitLabel, getExitStatus } from "../../lib/exit-codes";
import { formatBytes, formatDuration } from "../../lib/format";
import { LogEntriesTable } from "../log-entries/log-entries-table";

interface RecentRunsProps {
  runs: Run[];
}

function StatRow({ label, total, copied, skipped, failed }: {
  label: string;
  total: number | null;
  copied: number | null;
  skipped: number | null;
  failed: number | null;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground w-10">{label}:</span>
      <span>{total ?? "-"} total</span>
      <span className="text-muted-foreground">|</span>
      <span>{copied ?? "-"} copied</span>
      <span className="text-muted-foreground">|</span>
      <span>{skipped ?? "-"} skipped</span>
      <span className="text-muted-foreground">|</span>
      <span className={failed ? "text-red-500" : ""}>{failed ?? "-"} failed</span>
    </div>
  );
}

function RunRow({ run }: { run: Run }) {
  const [expanded, setExpanded] = useState(false);
  const [showEntries, setShowEntries] = useState(false);
  const status = getExitStatus(run.exit_code);
  const color = getExitColor(status);
  const dt = new Date(run.started_at);
  const date = dt.toLocaleDateString();
  const time = dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <div>
      <button
        className="flex items-center text-sm gap-2 w-full hover:bg-accent/50 rounded px-1 py-0.5"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? <ChevronDown className="w-3 h-3 shrink-0" /> : <ChevronRight className="w-3 h-3 shrink-0" />}
        <span className="text-muted-foreground shrink-0 mr-2">{date} {time}</span>
        <span className={`${color} shrink-0`}>{getExitLabel(run.exit_code)}</span>
        {run.files_copied != null && (
          <span className="text-muted-foreground">
            {run.files_copied} copied{run.files_failed ? `, ${run.files_failed} failed` : ""}
          </span>
        )}
      </button>
      {expanded && (
        <div className="ml-5 mt-1 mb-2 pl-3 border-l-2 border-border text-xs space-y-1">
          <StatRow label="Dirs" total={run.dirs_total} copied={run.dirs_copied} skipped={run.dirs_skipped} failed={run.dirs_failed} />
          <StatRow label="Files" total={run.files_total} copied={run.files_copied} skipped={run.files_skipped} failed={run.files_failed} />
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground w-10">Bytes:</span>
            <span>{formatBytes(run.bytes_total)} total</span>
            <span className="text-muted-foreground">|</span>
            <span>{formatBytes(run.bytes_copied)} copied</span>
          </div>
          <div className="flex items-center gap-4">
            <div>
              <span className="text-muted-foreground">Speed: </span>
              {run.speed_bytes_per_sec != null ? `${formatBytes(run.speed_bytes_per_sec)}/s` : "-"}
            </div>
            <div>
              <span className="text-muted-foreground">Duration: </span>
              {formatDuration(run.started_at, run.finished_at)}
            </div>
          </div>
          <div>
            <span className="text-muted-foreground">Exit code: </span>
            {run.exit_code ?? "N/A"} ({getExitLabel(run.exit_code)})
          </div>
          <button
            className="text-xs text-muted-foreground hover:text-foreground underline"
            onClick={() => setShowEntries(!showEntries)}
          >
            {showEntries ? "Hide Details" : "View Details"}
          </button>
          {showEntries && <LogEntriesTable runId={run.id} />}
        </div>
      )}
    </div>
  );
}

export function RecentRuns({ runs }: RecentRunsProps) {
  if (runs.length === 0) {
    return <p className="text-sm text-muted-foreground">No runs yet</p>;
  }

  return (
    <div className="space-y-1">
      {runs.map((run) => (
        <RunRow key={run.id} run={run} />
      ))}
    </div>
  );
}
