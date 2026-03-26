import { useState, useMemo } from "react";
import { AppShell } from "./components/layout/app-shell";
import { TaskSidebar } from "./components/task-list/task-sidebar";
import { TaskDetail } from "./components/task-list/task-detail";
import { TaskEditor } from "./components/task-editor/task-editor";
import { HistoryView } from "./components/run-history/history-view";
import { useConfig } from "./hooks/use-config";
import { useRunningTasks } from "./hooks/use-running-tasks";
import { useRuns } from "./hooks/use-runs";
import type { Task, Run } from "./lib/types";
import { commands } from "./lib/commands";

type View = "tasks" | "history";
type EditorState = { task: Task | null } | null;

function App() {
  const [view, setView] = useState<View>("tasks");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [editorState, setEditorState] = useState<EditorState>(null);
  const { config, loading, saveTask, deleteTask } = useConfig();
  const { isRunning, runTask, cancelTask } = useRunningTasks();

  // Fetch runs for selected task (detail view)
  const { runs: selectedTaskRuns } = useRuns(selectedTaskId ?? undefined, 10);

  // Fetch all runs to derive lastRuns for sidebar status dots
  const { runs: allRuns } = useRuns(undefined, 500);

  // Build lastRuns map: task_id -> most recent Run
  const lastRuns = useMemo(() => {
    const map: Record<string, Run | undefined> = {};
    for (const run of allRuns) {
      if (!map[run.task_id]) {
        map[run.task_id] = run;
      }
    }
    return map;
  }, [allRuns]);

  if (loading || !config) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  const selectedTask = config.tasks.find((t) => t.id === selectedTaskId) ?? null;

  const handleRunGroup = async (groupId: string) => {
    await commands.runGroup(groupId);
  };

  const handleNewTask = () => {
    setEditorState({ task: null });
  };

  const handleEditTask = () => {
    if (selectedTask) {
      setEditorState({ task: selectedTask });
    }
  };

  const handleSaveTask = async (task: Task) => {
    await saveTask(task);
    setEditorState(null);
    setSelectedTaskId(task.id);
  };

  const handleDeleteTask = async () => {
    if (selectedTaskId) {
      await deleteTask(selectedTaskId);
      setSelectedTaskId(null);
    }
  };

  const handleRunTask = async () => {
    if (selectedTaskId) {
      await runTask(selectedTaskId);
    }
  };

  const handleCancelTask = async () => {
    if (selectedTaskId) {
      await cancelTask(selectedTaskId);
    }
  };

  const sidebar = (
    <div className="flex flex-col h-full">
      <TaskSidebar
        config={config}
        selectedTaskId={selectedTaskId}
        onSelectTask={(id) => { setSelectedTaskId(id); setEditorState(null); }}
        onRunGroup={handleRunGroup}
        onNewTask={handleNewTask}
        isRunning={isRunning}
        lastRuns={lastRuns}
      />
      <div className="border-t border-border p-2 space-y-1">
        <button
          className={`w-full text-left px-3 py-2 rounded text-sm ${view === "tasks" ? "bg-accent" : "hover:bg-accent/50"}`}
          onClick={() => setView("tasks")}
        >
          Tasks
        </button>
        <button
          className={`w-full text-left px-3 py-2 rounded text-sm ${view === "history" ? "bg-accent" : "hover:bg-accent/50"}`}
          onClick={() => setView("history")}
        >
          Run History
        </button>
      </div>
    </div>
  );

  return (
    <AppShell sidebar={sidebar}>
      {view === "tasks" && editorState !== null && (
        <TaskEditor
          task={editorState.task}
          groups={config.groups}
          settings={config.settings}
          onSave={handleSaveTask}
          onCancel={() => setEditorState(null)}
        />
      )}
      {view === "tasks" && editorState === null && selectedTask && (
        <TaskDetail
          task={selectedTask}
          isRunning={isRunning(selectedTask.id)}
          runs={selectedTaskRuns}
          onRun={handleRunTask}
          onCancel={handleCancelTask}
          onEdit={handleEditTask}
          onDelete={handleDeleteTask}
        />
      )}
      {view === "tasks" && editorState === null && !selectedTask && (
        <div className="flex items-center justify-center h-full text-muted-foreground">
          Select a task or create a new one
        </div>
      )}
      {view === "history" && (
        <HistoryView config={config} />
      )}
    </AppShell>
  );
}

export default App;
