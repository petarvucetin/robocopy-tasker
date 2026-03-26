import { Checkbox } from "../ui/checkbox";
import { Label } from "../ui/label";

interface OptionCheckboxProps {
  flag: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export function OptionCheckbox({ flag, label, checked, onChange }: OptionCheckboxProps) {
  const id = `opt-${flag}`;
  return (
    <div className="flex items-center gap-2">
      <Checkbox id={id} checked={checked} onCheckedChange={onChange} />
      <Label htmlFor={id} className="text-sm cursor-pointer">
        <span className="font-mono text-xs text-muted-foreground">/{flag}</span>{" "}
        {label}
      </Label>
    </div>
  );
}
