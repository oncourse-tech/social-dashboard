"use client";

import { Fragment, useMemo, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

type HeatmapData = Record<string, number>; // "day-hour" -> count

export function ActivityClient({
  heatmap,
  apps,
}: {
  heatmap: HeatmapData;
  apps: { id: string; name: string; color: string }[];
}) {
  const [appFilter, setAppFilter] = useState("all");

  // The heatmap data is pre-computed server-side for all apps;
  // app-specific filtering would need per-app data from server,
  // but for now we show the aggregated heatmap.
  // In a full implementation, we'd pass per-app heatmaps.

  const maxCount = useMemo(() => {
    return Math.max(1, ...Object.values(heatmap));
  }, [heatmap]);

  const { bestDay, bestHour } = useMemo(() => {
    let maxKey = "";
    let maxVal = 0;
    for (const [key, val] of Object.entries(heatmap)) {
      if (val > maxVal) {
        maxVal = val;
        maxKey = key;
      }
    }
    if (!maxKey) return { bestDay: "N/A", bestHour: "N/A" };
    const [d, h] = maxKey.split("-").map(Number);
    return {
      bestDay: DAYS[d] ?? "N/A",
      bestHour: `${h}:00`,
    };
  }, [heatmap]);

  function getCellColor(count: number): string {
    if (count === 0) return "bg-muted";
    const intensity = count / maxCount;
    if (intensity > 0.75) return "bg-green-500";
    if (intensity > 0.5) return "bg-green-400";
    if (intensity > 0.25) return "bg-green-600/60";
    return "bg-green-800/40";
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <Select
          value={appFilter}
          onValueChange={(val: string | null) => setAppFilter(val ?? "all")}
        >
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="All Apps" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Apps</SelectItem>
            {apps.map((app) => (
              <SelectItem key={app.id} value={app.id}>
                {app.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <p className="text-sm text-muted-foreground">
          Most posts on <span className="font-medium text-foreground">{bestDay}</span>{" "}
          at <span className="font-medium text-foreground">{bestHour}</span>
        </p>
      </div>

      <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
        <div
          className="grid gap-1 min-w-[640px]"
          style={{
            gridTemplateColumns: `auto repeat(24, minmax(20px, 1fr))`,
            gridTemplateRows: `auto repeat(7, 28px)`,
          }}
        >
          {/* Header row: hours */}
          <div />
          {HOURS.map((h) => (
            <div
              key={`h-${h}`}
              className="flex items-end justify-center text-[10px] text-muted-foreground pb-0.5"
            >
              {h}
            </div>
          ))}

          {/* Data rows */}
          {DAYS.map((day, dayIdx) => (
            <Fragment key={`d-${dayIdx}`}>
              <div
                className="flex items-center pr-2 text-xs text-muted-foreground"
              >
                {day}
              </div>
              {HOURS.map((hour) => {
                const key = `${dayIdx}-${hour}`;
                const count = heatmap[key] ?? 0;
                return (
                  <div
                    key={key}
                    className={cn(
                      "rounded-sm transition-colors",
                      getCellColor(count)
                    )}
                    title={`${day} ${hour}:00 - ${count} posts`}
                  />
                );
              })}
            </Fragment>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>Less</span>
        <div className="size-3 rounded-sm bg-muted" />
        <div className="size-3 rounded-sm bg-green-800/40" />
        <div className="size-3 rounded-sm bg-green-600/60" />
        <div className="size-3 rounded-sm bg-green-400" />
        <div className="size-3 rounded-sm bg-green-500" />
        <span>More</span>
      </div>
    </div>
  );
}
