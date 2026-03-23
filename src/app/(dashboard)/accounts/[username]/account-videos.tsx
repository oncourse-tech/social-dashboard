"use client";

import { useState, useMemo } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { ExternalLink, Search, Filter } from "lucide-react";
import { VideoFormat } from "@prisma/client";
import { ViewToggle } from "@/components/view-toggle";
import { VideoGrid, type VideoCardData } from "@/components/video-grid";
import { DataTable } from "@/components/data-table";
import { FormatBadge } from "@/components/format-badge";
import { ViralTierBadge } from "@/components/viral-tier-badge";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { LabeledSelect, SelectItem } from "@/components/labeled-select";
import {
  formatNumber,
  getViralTier,
  relativeDate,
  calcEngagementRate,
  formatEngagementRate,
} from "@/lib/utils";
import { FORMAT_LABELS } from "@/lib/constants";

type AccountVideo = VideoCardData & {
  hook: string | null;
  script: string | null;
  cta: string | null;
};

const listColumns: ColumnDef<AccountVideo, unknown>[] = [
  {
    accessorKey: "hook",
    header: "Hook",
    enableSorting: false,
    cell: ({ row }) => {
      const hookText = row.original.hook || "";
      const fallbackText = !hookText
        ? (row.original.description || "").slice(0, 60)
        : "";
      const displayText = hookText || fallbackText;

      if (!displayText) {
        return (
          <span className="text-xs text-muted-foreground italic">No hook</span>
        );
      }

      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger className="text-left">
              <p
                className={`line-clamp-2 max-w-[250px] text-sm leading-snug ${
                  !hookText ? "text-muted-foreground" : "text-foreground"
                }`}
              >
                {displayText}
              </p>
            </TooltipTrigger>
            <TooltipContent side="bottom" align="start" className="max-w-sm">
              {hookText || fallbackText}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    },
  },
  {
    accessorKey: "postedAt",
    header: "Posted",
    cell: ({ row }) => (
      <span className="text-xs text-muted-foreground">
        {relativeDate(row.original.postedAt)}
      </span>
    ),
  },
  {
    accessorKey: "views",
    header: "Views",
    cell: ({ row }) => formatNumber(row.original.views),
  },
  {
    accessorKey: "likes",
    header: "Likes",
    cell: ({ row }) => formatNumber(row.original.likes),
  },
  {
    id: "engRate",
    header: "Eng. Rate",
    accessorFn: (row) =>
      calcEngagementRate(row.views, row.likes, row.comments, row.shares),
    cell: ({ row }) => {
      const rate = calcEngagementRate(
        row.original.views,
        row.original.likes,
        row.original.comments,
        row.original.shares
      );
      return (
        <span className="tabular-nums text-xs font-medium">
          {formatEngagementRate(rate)}
        </span>
      );
    },
  },
  {
    accessorKey: "comments",
    header: "Comments",
    cell: ({ row }) => formatNumber(row.original.comments),
  },
  {
    accessorKey: "shares",
    header: "Shares",
    cell: ({ row }) => formatNumber(row.original.shares),
  },
  {
    accessorKey: "format",
    header: "Format",
    cell: ({ row }) => <FormatBadge format={row.original.format} />,
  },
  {
    id: "tier",
    header: "Tier",
    cell: ({ row }) => {
      const tier = getViralTier(row.original.views);
      return <ViralTierBadge tier={tier} />;
    },
  },
  {
    id: "link",
    header: "",
    enableSorting: false,
    cell: ({ row }) => {
      const url = `https://www.tiktok.com/@${row.original.account?.username ?? "user"}/video/${row.original.tiktokVideoId}`;
      return (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center text-muted-foreground hover:text-foreground"
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink className="size-4" />
        </a>
      );
    },
  },
];

const FORMAT_OPTIONS = Object.entries(FORMAT_LABELS) as [VideoFormat, string][];

export function AccountVideos({
  videos,
  username,
}: {
  videos: AccountVideo[];
  username: string;
}) {
  const [view, setView] = useState<"grid" | "list">("grid");
  const [search, setSearch] = useState("");
  const [formatFilter, setFormatFilter] = useState<string>("all");
  const [dateRange, setDateRange] = useState<string>("all");

  const filtered = useMemo(() => {
    return videos.filter((v) => {
      if (formatFilter !== "all" && v.format !== formatFilter) return false;

      if (dateRange !== "all") {
        const now = new Date();
        let cutoff: Date;
        if (dateRange === "7d") {
          cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        } else if (dateRange === "30d") {
          cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        } else {
          cutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        }
        if (new Date(v.postedAt) < cutoff) return false;
      }

      if (!search) return true;
      const q = search.toLowerCase();
      return (
        v.description.toLowerCase().includes(q) ||
        v.hashtags.some((h) => h.toLowerCase().includes(q)) ||
        (v.hook && v.hook.toLowerCase().includes(q))
      );
    });
  }, [videos, search, formatFilter, dateRange]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">
          Videos{" "}
          <span className="text-muted-foreground text-sm font-normal">
            ({filtered.length})
          </span>
        </h2>
        <ViewToggle view={view} onChange={setView} />
      </div>

      <div className="relative max-w-xs">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Search description, hooks, or hashtags..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-3">
        <Filter className="size-4 text-muted-foreground shrink-0" />

        <LabeledSelect label="Format" value={formatFilter} onChange={(val) => setFormatFilter(val)}>
          <SelectItem value="all">All Formats</SelectItem>
          {FORMAT_OPTIONS.map(([value, label]) => (
            <SelectItem key={value} value={value}>{label}</SelectItem>
          ))}
        </LabeledSelect>

        <LabeledSelect label="Period" value={dateRange} onChange={(val) => setDateRange(val)}>
          <SelectItem value="all">All Time</SelectItem>
          <SelectItem value="7d">Last 7 days</SelectItem>
          <SelectItem value="30d">Last 30 days</SelectItem>
          <SelectItem value="90d">Last 90 days</SelectItem>
        </LabeledSelect>
      </div>

      {view === "grid" ? (
        <VideoGrid videos={filtered} />
      ) : (
        <div className="overflow-x-auto">
          <DataTable columns={listColumns} data={filtered} />
        </div>
      )}
    </div>
  );
}
