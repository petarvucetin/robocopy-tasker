import { Checkbox } from "../ui/checkbox";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

interface OptionStringProps {
  flag: string;
  label: string;
  value: string | null;
  placeholder?: string;
  onChange: (value: string | null) => void;
}

export function OptionString({ flag, label, value, placeholder, onChange }: OptionStringProps) {
  const enabled = value !== null;
  const id = `opt-${flag}`;

  return (
    <div className="flex items-center gap-2">
      <Checkbox
        id={id}
        checked={enabled}
        onCheckedChange={(checked) => onChange(checked ? "" : null)}
      />
      <Label htmlFor={id} className="text-sm cursor-pointer whitespace-nowrap">
        <span className="font-mono text-xs text-muted-foreground">/{flag.toUpperCase()}</span>{" "}
        {label}
      </Label>
      {enabled && (
        <Input
          className="w-28 h-7 text-sm font-mono"
          value={value ?? ""}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}
