import type { Run } from "../../lib/types";
import { getExitColor, getExitLabel, getExitStatus } from "../../lib/exit-codes";

interface RecentRunsProps {
  runs: Run[];
}

export function RecentRuns({ runs }: RecentRunsProps) {
  if (runs.length === 0) {
    return <p className="text-sm text-muted-foreground">No runs yet</p>;
  }

  return (
    <div className="space-y-2">
      {runs.map((run) => {
        const status = getExitStatus(run.exit_code);
        const color = getExitColor(status);
        const date = new Date(run.started_at).toLocaleDateString();

        return (
          <div key={run.id} className="flex items-center text-sm gap-3">
            <span className="text-muted-foreground w-16">{date}</span>
            <span className={color}>{getExitLabel(run.exit_code)}</span>
            {run.files_copied != null && (
              <span className="text-muted-foreground">
                {run.files_copied} copied{run.files_failed ? `, ${run.files_failed} failed` : ""}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
