import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Separator } from "../ui/separator";
import { OptionCheckbox } from "./option-checkbox";
import { OptionValue } from "./option-value";
import { OptionList } from "./option-list";
import { CommandPreview } from "./command-preview";
import type { Group, RobocopyOptions, Settings, Task } from "../../lib/types";
import { DEFAULT_OPTIONS } from "../../lib/types";

interface TaskEditorProps {
  task: Task | null;  // null = creating new
  groups: Group[];
  settings: Settings;
  onSave: (task: Task) => void;
  onCancel: () => void;
}

export function TaskEditor({ task, groups, settings, onSave, onCancel }: TaskEditorProps) {
  const [name, setName] = useState(task?.name ?? "");
  const [source, setSource] = useState(task?.source ?? "");
  const [destination, setDestination] = useState(task?.destination ?? "");
  const [group, setGroup] = useState<string | null>(task?.group ?? null);
  const [options, setOptions] = useState<RobocopyOptions>(task?.options ?? { ...DEFAULT_OPTIONS });
  const [error, setError] = useState<string | null>(null);

  const updateOption = <K extends keyof RobocopyOptions>(key: K, value: RobocopyOptions[K]) => {
    setOptions((prev) => ({ ...prev, [key]: value }));
  };

  const handleBrowse = async (setter: (v: string) => void) => {
    const dir = await open({ directory: true });
    if (dir) setter(dir);
  };

  const handleSave = () => {
    if (!name.trim()) { setError("Name is required"); return; }
    if (!source.trim()) { setError("Source path is required"); return; }
    if (!destination.trim()) { setError("Destination path is required"); return; }

    onSave({
      id: task?.id ?? crypto.randomUUID(),
      name: name.trim(),
      source: source.trim(),
      destination: destination.trim(),
      options,
      group,
    });
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">{task ? "Edit Task" : "New Task"}</h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button onClick={handleSave}>Save</Button>
        </div>
      </div>

      {error && <div className="text-sm text-red-500">{error}</div>}

      <div className="grid gap-4">
        <div className="grid gap-2">
          <Label>Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="My Backup Task" />
        </div>

        <div className="grid gap-2">
          <Label>Group</Label>
          <Select value={group ?? "__none__"} onValueChange={(v) => setGroup(v === "__none__" ? null : v)}>
            <SelectTrigger><SelectValue placeholder="No group" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">No group</SelectItem>
              {groups.map((g) => (
                <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label>Source</Label>
          <div className="flex gap-2">
            <Input className="flex-1" value={source} onChange={(e) => setSource(e.target.value)} placeholder="C:\Users\..." />
            <Button variant="outline" onClick={() => handleBrowse(setSource)}>Browse</Button>
          </div>
        </div>

        <div className="grid gap-2">
          <Label>Destination</Label>
          <div className="flex gap-2">
            <Input className="flex-1" value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="J:\backup\..." />
            <Button variant="outline" onClick={() => handleBrowse(setDestination)}>Browse</Button>
          </div>
        </div>
      </div>

      <Separator />

      <div>
        <h3 className="text-sm font-medium mb-3">Robocopy Options</h3>
        <div className="grid grid-cols-2 gap-3">
          <OptionCheckbox flag="s" label="Copy subdirectories" checked={options.s} onChange={(v) => updateOption("s", v)} />
          <OptionCheckbox flag="j" label="Unbuffered I/O" checked={options.j} onChange={(v) => updateOption("j", v)} />
          <OptionCheckbox flag="sj" label="Copy junctions as junctions" checked={options.sj} onChange={(v) => updateOption("sj", v)} />
          <OptionCheckbox flag="xj" label="Exclude junctions" checked={options.xj} onChange={(v) => updateOption("xj", v)} />
          <OptionCheckbox flag="xjd" label="Exclude junction dirs" checked={options.xjd} onChange={(v) => updateOption("xjd", v)} />
          <OptionCheckbox flag="xjf" label="Exclude junction files" checked={options.xjf} onChange={(v) => updateOption("xjf", v)} />
          <OptionCheckbox flag="tee" label="Console + log output" checked={options.tee} onChange={(v) => updateOption("tee", v)} />
        </div>

        <div className="grid grid-cols-2 gap-3 mt-3">
          <OptionValue flag="mt" label="Threads" value={options.mt} min={1} max={128} onChange={(v) => updateOption("mt", v)} />
          <OptionValue flag="r" label="Retry count" value={options.r} min={0} onChange={(v) => updateOption("r", v)} />
          <OptionValue flag="w" label="Wait (seconds)" value={options.w} min={0} onChange={(v) => updateOption("w", v)} />
        </div>
      </div>

      <OptionList
        flag="xd"
        label="Exclude directories"
        entries={options.xd}
        onChange={(v) => updateOption("xd", v)}
        placeholder="C:\$Recycle.Bin"
      />

      <OptionList
        flag="xf"
        label="Exclude files"
        entries={options.xf}
        onChange={(v) => updateOption("xf", v)}
        placeholder="*.tmp"
      />

      <Separator />

      <CommandPreview
        source={source}
        destination={destination}
        options={options}
        logDirectory={settings.logDirectory}
        taskName={name}
      />
    </div>
  );
}
