import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { RunDetailRow } from "./run-detail-row";
import { useRuns } from "../../hooks/use-runs";
import { commands } from "../../lib/commands";
import { getExitStatus } from "../../lib/exit-codes";
import type { AppConfig } from "../../lib/types";

interface HistoryViewProps {
  config: AppConfig;
}

type StatusFilter = "all" | "success" | "warning" | "error" | "cancelled";

export function HistoryView({ config }: HistoryViewProps) {
  const [filterTaskId, setFilterTaskId] = useState<string | undefined>(undefined);
  const [filterStatus, setFilterStatus] = useState<StatusFilter>("all");
  const { runs: allRuns, loading, refresh } = useRuns(filterTaskId, 200);

  // Client-side status filtering
  const runs = filterStatus === "all"
    ? allRuns
    : allRuns.filter((r) => {
        const s = getExitStatus(r.exit_code);
        return s === filterStatus;
      });

  const handleCleanup = async (days: number) => {
    await commands.cleanupOldRuns(days);
    refresh();
  };

  // Build task list for filter (include names from runs for deleted tasks)
  const taskNames = new Map<string, string>();
  for (const task of config.tasks) {
    taskNames.set(task.id, task.name);
  }
  for (const run of allRuns) {
    if (!taskNames.has(run.task_id)) {
      taskNames.set(run.task_id, `${run.task_name} (deleted)`);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Run History</h2>
        <div className="flex gap-2">
          <Select value={filterTaskId ?? "__all__"} onValueChange={(v: string | null) => setFilterTaskId(!v || v === "__all__" ? undefined : v)}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All tasks" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All tasks</SelectItem>
              {Array.from(taskNames.entries()).map(([id, name]) => (
                <SelectItem key={id} value={id}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as StatusFilter)}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="success">Success</SelectItem>
              <SelectItem value="warning">Warning</SelectItem>
              <SelectItem value="error">Error</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          <Select onValueChange={(v: string | null) => { if (v) handleCleanup(parseInt(v)); }}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Clear old..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30">Older than 30d</SelectItem>
              <SelectItem value="60">Older than 60d</SelectItem>
              <SelectItem value="90">Older than 90d</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="border border-border rounded-md">
        <div className="flex items-center px-4 py-2 text-xs font-medium text-muted-foreground bg-muted/50 gap-4">
          <span className="w-4" />
          <span className="w-20">Date</span>
          <span className="w-16">Time</span>
          <span className="w-40">Task</span>
          <span className="w-32">Status</span>
          <span className="w-20 text-right">Copied</span>
          <span className="w-20 text-right">Failed</span>
        </div>
        {loading ? (
          <div className="p-4 text-sm text-muted-foreground">Loading...</div>
        ) : runs.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">No runs recorded</div>
        ) : (
          runs.map((run) => <RunDetailRow key={run.id} run={run} />)
        )}
      </div>
    </div>
  );
}
