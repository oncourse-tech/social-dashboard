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
    <div className="flex flex-col gap-0.5 min-w-0 flex-1 sm:flex-initial">
      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
        {label}
      </span>
      <Select value={value} onValueChange={(val) => onChange(val ?? value)}>
        <SelectTrigger className="h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>{children}</SelectContent>
      </Select>
    </div>
  );
}

// Re-export SelectItem for convenience
export { SelectItem };
