import { useCallback, useEffect, useState } from "react";
import { commands } from "../lib/commands";
import { onTaskCompleted } from "../lib/events";
import type { RunningTask, TaskCompletedEvent } from "../lib/types";

export function useRunningTasks() {
  const [running, setRunning] = useState<RunningTask[]>([]);

  const refresh = useCallback(async () => {
    const tasks = await commands.getRunningTasks();
    setRunning(tasks);
  }, []);

  useEffect(() => {
    refresh();
    const unlisten = onTaskCompleted((_event: TaskCompletedEvent) => { refresh(); });
    return () => { unlisten.then((fn) => fn()); };
  }, [refresh]);

  const runTask = useCallback(async (taskId: string) => {
    await commands.runTask(taskId);
    await refresh();
  }, [refresh]);

  const cancelTask = useCallback(async (taskId: string) => {
    await commands.cancelTask(taskId);
    await refresh();
  }, [refresh]);

  const isRunning = useCallback((taskId: string) => {
    return running.some((r) => r.task_id === taskId);
  }, [running]);

  return { running, isRunning, runTask, cancelTask, refresh };
}
