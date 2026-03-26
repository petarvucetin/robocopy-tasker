import { useState } from "react";
import { AppShell } from "./components/layout/app-shell";
import { useConfig } from "./hooks/use-config";
import { useRunningTasks } from "./hooks/use-running-tasks";

type View = "tasks" | "history";

function App() {
  const [view, setView] = useState<View>("tasks");
  const [_selectedTaskId, _setSelectedTaskId] = useState<string | null>(null);
  const { config, loading, saveTask: _saveTask, deleteTask: _deleteTask, saveGroup: _saveGroup, deleteGroup: _deleteGroup } = useConfig();
  const { isRunning: _isRunning, runTask: _runTask, cancelTask: _cancelTask } = useRunningTasks();

  if (loading || !config) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  return (
    <AppShell
      sidebar={
        <div className="p-4">
          <h1 className="text-lg font-semibold mb-4">backup-gene</h1>
          <p className="text-sm text-muted-foreground">
            {config.tasks.length} tasks configured
          </p>
          <nav className="mt-4 space-y-1">
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
          </nav>
        </div>
      }
    >
      {view === "tasks" && (
        <div>
          <h2 className="text-xl font-semibold mb-4">Tasks</h2>
          <p className="text-muted-foreground">Task list coming next...</p>
        </div>
      )}
      {view === "history" && (
        <div>
          <h2 className="text-xl font-semibold mb-4">Run History</h2>
          <p className="text-muted-foreground">History view coming next...</p>
        </div>
      )}
    </AppShell>
  );
}

export default App;
