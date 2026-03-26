import { useCallback, useEffect, useState } from "react";
import { commands } from "../lib/commands";
import { onTaskCompleted } from "../lib/events";
import type { Run } from "../lib/types";

export function useRuns(taskId?: string, limit?: number) {
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await commands.getRuns(taskId, limit);
      setRuns(data);
    } catch (e) {
      console.error("Failed to load runs:", e);
    } finally {
      setLoading(false);
    }
  }, [taskId, limit]);

  useEffect(() => {
    refresh();
    const unlisten = onTaskCompleted(() => { refresh(); });
    return () => { unlisten.then((fn) => fn()); };
  }, [refresh]);

  return { runs, loading, refresh };
}
