import { useEffect, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { confirm, open } from "@tauri-apps/plugin-dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { commands } from "../../lib/commands";
import type { Settings } from "../../lib/types";

interface SettingsViewProps {
  settings: Settings;
  onSave: (settings: Settings) => void;
}

export function SettingsView({ settings, onSave }: SettingsViewProps) {
  const [logDirectory, setLogDirectory] = useState(settings.logDirectory);
  const [retentionDays, setRetentionDays] = useState(settings.historyRetentionDays);
  const [saved, setSaved] = useState(false);
  const [version, setVersion] = useState("");

  useEffect(() => { getVersion().then(setVersion); }, []);

  const dirty =
    logDirectory !== settings.logDirectory ||
    retentionDays !== settings.historyRetentionDays;

  const handleBrowse = async () => {
    const dir = await open({ directory: true });
    if (dir) {
      setLogDirectory(dir);
      setSaved(false);
    }
  };

  const handleSave = () => {
    onSave({ logDirectory, historyRetentionDays: retentionDays });
    setSaved(true);
  };

  return (
    <div className="space-y-6 max-w-xl">
      <h2 className="text-xl font-semibold">Settings</h2>

      <div className="grid gap-4">
        <div className="grid gap-2">
          <Label>Log directory</Label>
          <p className="text-xs text-muted-foreground">
            Robocopy log files are saved here. Each task gets a log file named after the task.
          </p>
          <div className="flex gap-2">
            <Input
              className="flex-1 font-mono text-sm"
              value={logDirectory}
              onChange={(e) => { setLogDirectory(e.target.value); setSaved(false); }}
              placeholder="C:\Users\you\robocopy-logs"
            />
            <Button variant="outline" onClick={handleBrowse}>Browse</Button>
          </div>
        </div>

        <div className="grid gap-2">
          <Label>History retention (days)</Label>
          <p className="text-xs text-muted-foreground">
            Run history older than this is automatically deleted on app startup.
          </p>
          <Input
            type="number"
            className="w-32"
            min={1}
            value={retentionDays}
            onChange={(e) => {
              const v = parseInt(e.target.value);
              if (!isNaN(v) && v > 0) {
                setRetentionDays(v);
                setSaved(false);
              }
            }}
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={!dirty && saved}>
          Save settings
        </Button>
        {saved && !dirty && (
          <span className="text-sm text-green-500">Saved</span>
        )}
      </div>
      <div className="pt-4 border-t border-border space-y-3">
        <div className="grid gap-2">
          <Label>Reset run history</Label>
          <p className="text-xs text-muted-foreground">
            Deletes all run history and log entry details from the database. Tasks and settings are not affected.
          </p>
          <Button
            variant="destructive"
            className="w-fit"
            onClick={async () => {
              const confirmed = await confirm("Reset all run history?\n\nThis deletes all runs and log entry details. Tasks and settings are not affected.\n\nThis cannot be undone.", { title: "Backup Gene", kind: "warning" });
              if (!confirmed) return;
              try {
                await commands.resetHistory();
                alert("History reset. Refresh to see changes.");
              } catch (e) {
                alert(`Failed to reset: ${e}`);
              }
            }}
          >
            Reset History
          </Button>
        </div>
        {version && (
          <p className="text-sm text-muted-foreground">Backup Gene v{version}</p>
        )}
      </div>
    </div>
  );
}
