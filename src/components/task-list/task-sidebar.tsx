import { ChevronDown, ChevronRight, Play, Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "../ui/button";
import type { AppConfig } from "../../lib/types";
import { getExitStatus } from "../../lib/exit-codes";
import type { Run } from "../../lib/types";

interface TaskSidebarProps {
  config: AppConfig;
  selectedTaskId: string | null;
  onSelectTask: (taskId: string) => void;
  onRunGroup: (groupId: string) => void;
  onNewTask: () => void;
  isRunning: (taskId: string) => boolean;
  lastRuns: Record<string, Run | undefined>;
}

export function TaskSidebar({
  config,
  selectedTaskId,
  onSelectTask,
  onRunGroup,
  onNewTask,
  isRunning,
  lastRuns,
}: TaskSidebarProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const toggleGroup = (groupId: string) => {
    setCollapsed((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  // Group tasks
  const grouped = new Map<string | null, typeof config.tasks>();
  for (const task of config.tasks) {
    const key = task.group;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(task);
  }

  const getStatusDot = (taskId: string) => {
    if (isRunning(taskId)) return "bg-blue-500 animate-pulse";
    const lastRun = lastRuns[taskId];
    if (!lastRun) return "bg-gray-400";
    const status = getExitStatus(lastRun.exit_code);
    switch (status) {
      case "success": return "bg-green-500";
      case "warning": return "bg-yellow-500";
      case "error": return "bg-red-500";
      default: return "bg-gray-400";
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-border">
        <h1 className="text-lg font-semibold">backup-gene</h1>
      </div>

      <div className="flex-1 overflow-auto p-2">
        {config.groups.map((group) => {
          const tasks = grouped.get(group.id) || [];
          const isCollapsed = collapsed[group.id];

          return (
            <div key={group.id} className="mb-1">
              <button
                className="flex items-center w-full px-2 py-1.5 text-sm font-medium hover:bg-accent/50 rounded group"
                onClick={() => toggleGroup(group.id)}
              >
                {isCollapsed ? <ChevronRight className="w-4 h-4 mr-1" /> : <ChevronDown className="w-4 h-4 mr-1" />}
                {group.name}
                <span className="ml-auto text-xs text-muted-foreground">{tasks.length}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="ml-1 h-6 w-6 opacity-0 group-hover:opacity-100"
                  onClick={(e) => { e.stopPropagation(); onRunGroup(group.id); }}
                  title="Run group"
                >
                  <Play className="w-3 h-3" />
                </Button>
              </button>
              {!isCollapsed && tasks.map((task) => (
                <button
                  key={task.id}
                  className={`flex items-center w-full px-2 py-1.5 pl-7 text-sm rounded ${
                    selectedTaskId === task.id ? "bg-accent" : "hover:bg-accent/50"
                  }`}
                  onClick={() => onSelectTask(task.id)}
                >
                  <span className={`w-2 h-2 rounded-full mr-2 ${getStatusDot(task.id)}`} />
                  <span className="truncate">{task.name}</span>
                </button>
              ))}
            </div>
          );
        })}

        {/* Ungrouped tasks */}
        {(grouped.get(null) || []).map((task) => (
          <button
            key={task.id}
            className={`flex items-center w-full px-2 py-1.5 text-sm rounded ${
              selectedTaskId === task.id ? "bg-accent" : "hover:bg-accent/50"
            }`}
            onClick={() => onSelectTask(task.id)}
          >
            <span className={`w-2 h-2 rounded-full mr-2 ${getStatusDot(task.id)}`} />
            <span className="truncate">{task.name}</span>
          </button>
        ))}
      </div>

      <div className="p-2 border-t border-border">
        <Button variant="outline" className="w-full" onClick={onNewTask}>
          <Plus className="w-4 h-4 mr-2" /> New Task
        </Button>
      </div>
    </div>
  );
}
