"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function LabeledSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide shrink-0">
        {label}
      </span>
      <Select value={value} onValueChange={(val) => onChange(val ?? value)}>
        <SelectTrigger className="h-8 w-auto min-w-[100px] text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>{children}</SelectContent>
      </Select>
    </div>
  );
}

// Re-export SelectItem for convenience
export { SelectItem };
