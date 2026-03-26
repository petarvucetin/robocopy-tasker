import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { TaskCompletedEvent } from "./types";

export function onTaskCompleted(
  callback: (event: TaskCompletedEvent) => void
): Promise<UnlistenFn> {
  return listen<TaskCompletedEvent>("task-completed", (event) => {
    callback(event.payload);
  });
}
