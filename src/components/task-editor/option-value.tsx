import { Checkbox } from "../ui/checkbox";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

interface OptionValueProps {
  flag: string;
  label: string;
  value: number | null;
  min?: number;
  max?: number;
  onChange: (value: number | null) => void;
}

export function OptionValue({ flag, label, value, min, max, onChange }: OptionValueProps) {
  const enabled = value !== null;
  const id = `opt-${flag}`;

  return (
    <div className="flex items-center gap-2">
      <Checkbox
        id={id}
        checked={enabled}
        onCheckedChange={(checked) => onChange(checked ? (min ?? 0) : null)}
      />
      <Label htmlFor={id} className="text-sm cursor-pointer">
        <span className="font-mono text-xs text-muted-foreground">/{flag}</span>{" "}
        {label}
      </Label>
      {enabled && (
        <Input
          type="number"
          className="w-20 h-7 text-sm"
          value={value ?? ""}
          min={min}
          max={max}
          onChange={(e) => {
            const v = parseInt(e.target.value);
            if (!isNaN(v)) {
              const clamped = Math.max(min ?? 0, Math.min(max ?? Infinity, v));
              onChange(clamped);
            }
          }}
        />
      )}
    </div>
  );
}
