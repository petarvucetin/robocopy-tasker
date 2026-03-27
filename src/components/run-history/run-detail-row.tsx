import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import type { Run } from "../../lib/types";
import { getExitColor, getExitLabel, getExitStatus } from "../../lib/exit-codes";
import { formatBytes } from "../../lib/format";
import { LogEntriesTable } from "../log-entries/log-entries-table";

interface RunDetailRowProps {
  run: Run;
}

export function RunDetailRow({ run }: RunDetailRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [showEntries, setShowEntries] = useState(false);
  const status = getExitStatus(run.exit_code);
  const color = getExitColor(status);
  const date = new Date(run.started_at).toLocaleDateString();
  const time = new Date(run.started_at).toLocaleTimeString();

  return (
    <div className="border-b border-border">
      <button
        className="flex items-center w-full px-4 py-2 text-sm hover:bg-accent/50 gap-4"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        <span className="w-20 text-muted-foreground">{date}</span>
        <span className="w-16 text-muted-foreground">{time}</span>
        <span className="w-40 truncate">{run.task_name}</span>
        <span className={`w-32 ${color}`}>{getExitLabel(run.exit_code)}</span>
        <span className="w-20 text-right">{run.files_copied ?? "-"}</span>
        <span className="w-20 text-right">{run.files_failed ?? "-"}</span>
      </button>
      {expanded && (
        <div className="px-12 py-3 text-sm space-y-1 bg-muted/30">
          <div className="grid grid-cols-2 gap-x-8 gap-y-1">
            <div>
              <span className="text-muted-foreground">Dirs:</span>{" "}
              Total {run.dirs_total ?? "-"} | Copied {run.dirs_copied ?? "-"} | Skipped {run.dirs_skipped ?? "-"} | Failed {run.dirs_failed ?? "-"}
            </div>
            <div>
              <span className="text-muted-foreground">Files:</span>{" "}
              Total {run.files_total ?? "-"} | Copied {run.files_copied ?? "-"} | Skipped {run.files_skipped ?? "-"} | Failed {run.files_failed ?? "-"}
            </div>
            <div>
              <span className="text-muted-foreground">Bytes copied:</span>{" "}
              {formatBytes(run.bytes_copied)}
            </div>
            <div>
              <span className="text-muted-foreground">Speed:</span>{" "}
              {run.speed_bytes_per_sec != null ? `${formatBytes(run.speed_bytes_per_sec)}/s` : "-"}
            </div>
            <div>
              <span className="text-muted-foreground">Exit code:</span>{" "}
              {run.exit_code ?? "N/A"} ({getExitLabel(run.exit_code)})
            </div>
          </div>
          <button
            className="mt-2 text-xs text-muted-foreground hover:text-foreground underline"
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
