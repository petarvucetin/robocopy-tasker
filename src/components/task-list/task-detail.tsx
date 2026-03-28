import { Copy, Pencil, Play, Square, Trash2 } from "lucide-react";
import { Button } from "../ui/button";
import { RecentRuns } from "./recent-runs";
import type { Run, Task } from "../../lib/types";

interface TaskDetailProps {
  task: Task;
  isRunning: boolean;
  runs: Run[];
  onRun: () => void;
  onCancel: () => void;
  onEdit: () => void;
  onClone: () => void;
  onDelete: () => void;
}

export function TaskDetail({ task, isRunning, runs, onRun, onCancel, onEdit, onClone, onDelete }: TaskDetailProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">{task.name}</h2>
        <div className="mt-2 space-y-1 text-sm">
          <div>
            <span className="text-muted-foreground">Source:</span>{" "}
            <span className="font-mono">{task.source}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Dest:</span>{" "}
            <span className="font-mono">{task.destination}</span>
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        {isRunning ? (
          <Button variant="destructive" onClick={onCancel}>
            <Square className="w-4 h-4 mr-2" /> Cancel
          </Button>
        ) : (
          <Button onClick={onRun}>
            <Play className="w-4 h-4 mr-2" /> Run
          </Button>
        )}
        <Button variant="outline" onClick={onEdit}>
          <Pencil className="w-4 h-4 mr-2" /> Edit
        </Button>
        <Button variant="outline" onClick={onClone}>
          <Copy className="w-4 h-4 mr-2" /> Clone
        </Button>
        <Button variant="outline" onClick={onDelete}>
          <Trash2 className="w-4 h-4 mr-2" /> Delete
        </Button>
      </div>

      <div>
        <h3 className="text-sm font-medium mb-2">Recent Runs</h3>
        <RecentRuns runs={runs} />
      </div>
    </div>
  );
}
