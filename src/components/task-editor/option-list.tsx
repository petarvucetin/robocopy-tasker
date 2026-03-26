import { Plus, X } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

interface OptionListProps {
  flag: string;
  label: string;
  entries: string[];
  onChange: (entries: string[]) => void;
  placeholder?: string;
}

export function OptionList({ flag, label, entries, onChange, placeholder }: OptionListProps) {
  const addEntry = () => onChange([...entries, ""]);
  const removeEntry = (index: number) => onChange(entries.filter((_, i) => i !== index));
  const updateEntry = (index: number, value: string) => {
    const updated = [...entries];
    updated[index] = value;
    onChange(updated);
  };

  return (
    <div className="space-y-2">
      <div className="text-sm">
        <span className="font-mono text-xs text-muted-foreground">/{flag}</span>{" "}
        {label}
      </div>
      {entries.map((entry, i) => (
        <div key={i} className="flex gap-2">
          <Input
            className="h-8 text-sm flex-1"
            value={entry}
            placeholder={placeholder}
            onChange={(e) => updateEntry(i, e.target.value)}
          />
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeEntry(i)}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={addEntry}>
        <Plus className="w-3 h-3 mr-1" /> Add
      </Button>
    </div>
  );
}
