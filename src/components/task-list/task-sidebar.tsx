import { ChevronDown, ChevronRight, FolderPlus, Pencil, Play, Plus, Trash2, Check, X } from "lucide-react";
import { useEffect, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { confirm } from "@tauri-apps/plugin-dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import type { AppConfig, Group } from "../../lib/types";
import { getExitStatus } from "../../lib/exit-codes";
import type { Run } from "../../lib/types";

interface TaskSidebarProps {
  config: AppConfig;
  selectedTaskId: string | null;
  onSelectTask: (taskId: string) => void;
  onRunGroup: (groupId: string) => void;
  onNewTask: () => void;
  onSaveGroup: (group: Group) => void;
  onDeleteGroup: (groupId: string) => void;
  isRunning: (taskId: string) => boolean;
  lastRuns: Record<string, Run | undefined>;
}

export function TaskSidebar({
  config,
  selectedTaskId,
  onSelectTask,
  onRunGroup,
  onNewTask,
  onSaveGroup,
  onDeleteGroup,
  isRunning,
  lastRuns,
}: TaskSidebarProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [addingGroup, setAddingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [version, setVersion] = useState("");

  useEffect(() => { getVersion().then(setVersion); }, []);

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

  const startRename = (group: Group) => {
    setEditingGroupId(group.id);
    setEditingName(group.name);
  };

  const commitRename = () => {
    if (editingGroupId && editingName.trim()) {
      onSaveGroup({ id: editingGroupId, name: editingName.trim() });
    }
    setEditingGroupId(null);
    setEditingName("");
  };

  const cancelRename = () => {
    setEditingGroupId(null);
    setEditingName("");
  };

  const commitNewGroup = () => {
    if (newGroupName.trim()) {
      onSaveGroup({ id: crypto.randomUUID(), name: newGroupName.trim() });
    }
    setAddingGroup(false);
    setNewGroupName("");
  };

  const cancelNewGroup = () => {
    setAddingGroup(false);
    setNewGroupName("");
  };

  const handleDeleteGroup = async (group: Group) => {
    const tasksInGroup = grouped.get(group.id)?.length ?? 0;
    const msg = tasksInGroup > 0
      ? `Delete group "${group.name}"?\n\n${tasksInGroup} task(s) will become ungrouped.`
      : `Delete group "${group.name}"?`;
    const confirmed = await confirm(msg, { title: "Backup Gene", kind: "warning" });
    if (confirmed) onDeleteGroup(group.id);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-border">
        <h1 className="text-lg font-semibold">backup-gene</h1>
        {version && <p className="text-xs text-muted-foreground">v{version}</p>}
      </div>

      <div className="flex-1 overflow-auto p-2">
        {config.groups.map((group) => {
          const tasks = grouped.get(group.id) || [];
          const isCollapsed = collapsed[group.id];
          const isEditing = editingGroupId === group.id;

          return (
            <div key={group.id} className="mb-1">
              {isEditing ? (
                <div className="flex items-center gap-1 px-2 py-1">
                  <Input
                    className="h-7 text-sm flex-1"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") cancelRename(); }}
                    autoFocus
                  />
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={commitRename}>
                    <Check className="w-3 h-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={cancelRename}>
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ) : (
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
                    onClick={(e) => { e.stopPropagation(); startRename(group); }}
                    title="Rename group"
                  >
                    <Pencil className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100"
                    onClick={(e) => { e.stopPropagation(); handleDeleteGroup(group); }}
                    title="Delete group"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100"
                    onClick={(e) => { e.stopPropagation(); onRunGroup(group.id); }}
                    title="Run group"
                  >
                    <Play className="w-3 h-3" />
                  </Button>
                </button>
              )}
              {!isCollapsed && !isEditing && tasks.map((task) => (
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

        {/* New group input */}
        {addingGroup && (
          <div className="flex items-center gap-1 px-2 py-1 mb-1">
            <Input
              className="h-7 text-sm flex-1"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") commitNewGroup(); if (e.key === "Escape") cancelNewGroup(); }}
              placeholder="Group name"
              autoFocus
            />
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={commitNewGroup}>
              <Check className="w-3 h-3" />
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={cancelNewGroup}>
              <X className="w-3 h-3" />
            </Button>
          </div>
        )}

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

      <div className="p-2 border-t border-border space-y-1">
        <Button variant="outline" className="w-full" onClick={onNewTask}>
          <Plus className="w-4 h-4 mr-2" /> New Task
        </Button>
        <Button variant="outline" className="w-full" onClick={() => setAddingGroup(true)}>
          <FolderPlus className="w-4 h-4 mr-2" /> New Group
        </Button>
      </div>
    </div>
  );
}
