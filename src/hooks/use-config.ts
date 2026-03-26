import { useCallback, useEffect, useState } from "react";
import { commands } from "../lib/commands";
import type { AppConfig, Group, Settings, Task } from "../lib/types";

export function useConfig() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const cfg = await commands.getConfig();
      setConfig(cfg);
      setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const saveTask = useCallback(async (task: Task) => {
    const cfg = await commands.saveTask(task);
    setConfig(cfg);
    return cfg;
  }, []);

  const deleteTask = useCallback(async (taskId: string) => {
    const cfg = await commands.deleteTask(taskId);
    setConfig(cfg);
    return cfg;
  }, []);

  const saveGroup = useCallback(async (group: Group) => {
    const cfg = await commands.saveGroup(group);
    setConfig(cfg);
    return cfg;
  }, []);

  const deleteGroup = useCallback(async (groupId: string) => {
    const cfg = await commands.deleteGroup(groupId);
    setConfig(cfg);
    return cfg;
  }, []);

  const updateSettings = useCallback(async (settings: Settings) => {
    const cfg = await commands.updateSettings(settings);
    setConfig(cfg);
    return cfg;
  }, []);

  return { config, loading, error, reload, saveTask, deleteTask, saveGroup, deleteGroup, updateSettings };
}
