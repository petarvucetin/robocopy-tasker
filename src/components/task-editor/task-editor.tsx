import { useState, useMemo } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Separator } from "../ui/separator";
import { OptionCheckbox } from "./option-checkbox";
import { OptionValue } from "./option-value";
import { OptionString } from "./option-string";
import { OptionList } from "./option-list";
import { CommandPreview } from "./command-preview";
import { detectConflicts } from "../../lib/robocopy-conflicts";
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

  const warnings = useMemo(() => detectConflicts(options), [options]);
  const hasErrors = warnings.some((w) => w.level === "error");

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
    if (hasErrors) { setError("Fix option conflicts before saving"); return; }

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
          <Button onClick={handleSave} disabled={hasErrors}>Save</Button>
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

      {/* Conflict warnings */}
      {warnings.length > 0 && (
        <div className="space-y-1.5">
          {warnings.map((w, i) => (
            <div
              key={i}
              className={`text-xs px-3 py-2 rounded border ${
                w.level === "error"
                  ? "bg-red-500/10 border-red-500/30 text-red-400"
                  : "bg-amber-500/10 border-amber-500/30 text-amber-400"
              }`}
            >
              <span className="font-medium">{w.level === "error" ? "Conflict" : "Warning"}:</span>{" "}
              {w.message}
            </div>
          ))}
        </div>
      )}

      {/* Copy Mode */}
      <div>
        <h3 className="text-sm font-medium mb-3">Copy Mode</h3>
        <div className="grid grid-cols-2 gap-3">
          <OptionCheckbox flag="S" label="Subdirectories (skip empty)" checked={options.s} onChange={(v) => updateOption("s", v)} />
          <OptionCheckbox flag="E" label="Subdirectories (incl. empty)" checked={options.e} onChange={(v) => updateOption("e", v)} />
          <OptionCheckbox flag="MIR" label="Mirror (sync source→dest)" checked={options.mir} onChange={(v) => updateOption("mir", v)} />
          <OptionCheckbox flag="PURGE" label="Delete extra dest files" checked={options.purge} onChange={(v) => updateOption("purge", v)} />
          <OptionCheckbox flag="MOV" label="Move files (delete source)" checked={options.mov} onChange={(v) => updateOption("mov", v)} />
          <OptionCheckbox flag="MOVE" label="Move files + dirs" checked={options.move} onChange={(v) => updateOption("move", v)} />
          <OptionCheckbox flag="CREATE" label="Dir tree + zero-length files" checked={options.create} onChange={(v) => updateOption("create", v)} />
        </div>
      </div>

      {/* Copy Flags */}
      <div>
        <h3 className="text-sm font-medium mb-3">Copy Flags</h3>
        <div className="grid grid-cols-2 gap-3">
          <OptionCheckbox flag="Z" label="Restartable mode" checked={options.z} onChange={(v) => updateOption("z", v)} />
          <OptionCheckbox flag="B" label="Backup mode" checked={options.b} onChange={(v) => updateOption("b", v)} />
          <OptionCheckbox flag="ZB" label="Restartable + backup fallback" checked={options.zb} onChange={(v) => updateOption("zb", v)} />
          <OptionCheckbox flag="J" label="Unbuffered I/O (large files)" checked={options.j} onChange={(v) => updateOption("j", v)} />
          <OptionCheckbox flag="SEC" label="Copy security info" checked={options.sec} onChange={(v) => updateOption("sec", v)} />
          <OptionCheckbox flag="COPYALL" label="Copy all file info" checked={options.copyall} onChange={(v) => updateOption("copyall", v)} />
          <OptionCheckbox flag="NODCOPY" label="No directory info" checked={options.nodcopy} onChange={(v) => updateOption("nodcopy", v)} />
        </div>
        <div className="grid grid-cols-2 gap-3 mt-3">
          <OptionString flag="copy" label="File copy flags" value={options.copy} placeholder="DATSOU" onChange={(v) => updateOption("copy", v)} />
          <OptionString flag="dcopy" label="Dir copy flags" value={options.dcopy} placeholder="DAT" onChange={(v) => updateOption("dcopy", v)} />
        </div>
      </div>

      {/* Junctions */}
      <div>
        <h3 className="text-sm font-medium mb-3">Junctions</h3>
        <div className="grid grid-cols-2 gap-3">
          <OptionCheckbox flag="SJ" label="Copy junctions as junctions" checked={options.sj} onChange={(v) => updateOption("sj", v)} />
          <OptionCheckbox flag="XJ" label="Exclude junction points" checked={options.xj} onChange={(v) => updateOption("xj", v)} />
        </div>
      </div>

      {/* File Selection */}
      <div>
        <h3 className="text-sm font-medium mb-3">File Selection</h3>
        <div className="grid grid-cols-2 gap-3">
          <OptionString flag="maxage" label="Max file age" value={options.maxage} placeholder="30 or 20260101" onChange={(v) => updateOption("maxage", v)} />
          <OptionString flag="minage" label="Min file age" value={options.minage} placeholder="7" onChange={(v) => updateOption("minage", v)} />
          <OptionString flag="maxlad" label="Max last access" value={options.maxlad} placeholder="30" onChange={(v) => updateOption("maxlad", v)} />
          <OptionString flag="minlad" label="Min last access" value={options.minlad} placeholder="7" onChange={(v) => updateOption("minlad", v)} />
          <OptionValue flag="max" label="Max file size (bytes)" value={options.max} min={0} onChange={(v) => updateOption("max", v)} />
          <OptionValue flag="min" label="Min file size (bytes)" value={options.min} min={0} onChange={(v) => updateOption("min", v)} />
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

      {/* Performance */}
      <div>
        <h3 className="text-sm font-medium mb-3">Performance</h3>
        <div className="grid grid-cols-2 gap-3">
          <OptionValue flag="mt" label="Threads" value={options.mt} min={1} max={128} onChange={(v) => updateOption("mt", v)} />
          <OptionValue flag="r" label="Retry count" value={options.r} min={0} onChange={(v) => updateOption("r", v)} />
          <OptionValue flag="w" label="Wait (seconds)" value={options.w} min={0} onChange={(v) => updateOption("w", v)} />
        </div>
      </div>

      {/* Output */}
      <div>
        <h3 className="text-sm font-medium mb-3">Output</h3>
        <div className="grid grid-cols-2 gap-3">
          <OptionCheckbox flag="TEE" label="Console + log output" checked={options.tee} onChange={(v) => updateOption("tee", v)} />
        </div>
      </div>

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
