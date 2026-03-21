"use client";

import { LayoutGrid, List } from "lucide-react";
import { Button } from "@/components/ui/button";

type ViewMode = "grid" | "list";

export function ViewToggle({
  view,
  onChange,
}: {
  view: ViewMode;
  onChange: (v: ViewMode) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <Button
        variant={view === "grid" ? "secondary" : "ghost"}
        size="icon-sm"
        onClick={() => onChange("grid")}
        aria-label="Grid view"
      >
        <LayoutGrid className="size-4" />
      </Button>
      <Button
        variant={view === "list" ? "secondary" : "ghost"}
        size="icon-sm"
        onClick={() => onChange("list")}
        aria-label="List view"
      >
        <List className="size-4" />
      </Button>
    </div>
  );
}
