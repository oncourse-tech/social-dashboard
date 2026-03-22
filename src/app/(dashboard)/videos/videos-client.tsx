"use client";

import { useState, useMemo } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { ExternalLink, Eye, Heart, Search, Filter } from "lucide-react";
import { VideoGrid, type VideoCardData } from "@/components/video-grid";
import { DataTable } from "@/components/data-table";
import { ViewToggle } from "@/components/view-toggle";
import { AppBadge } from "@/components/app-badge";
import { FormatBadge } from "@/components/format-badge";
import { ViralTierBadge } from "@/components/viral-tier-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LabeledSelect, SelectItem } from "@/components/labeled-select";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";
import {
  formatNumber,
  getViralTier,
  relativeDate,
  calcEngagementRate,
  formatEngagementRate,
} from "@/lib/utils";
import { FORMAT_LABELS } from "@/lib/constants";
import { type VideoFormat } from "@prisma/client";

type AllVideo = VideoCardData & {
  hook: string | null;
  script: string | null;
  cta: string | null;
  account: { username: string };
  app: { id: string; name: string; color: string };
};

const columns: ColumnDef<AllVideo, unknown>[] = [
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
                className={`line-clamp-2 max-w-[300px] text-sm leading-snug ${
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
    accessorKey: "account",
    header: "Creator",
    enableSorting: false,
    cell: ({ row }) => (
      <span className="font-medium text-xs">
        @{row.original.account.username}
      </span>
    ),
  },
  {
    accessorKey: "app",
    header: "App",
    enableSorting: false,
    cell: ({ row }) => (
      <AppBadge name={row.original.app.name} color={row.original.app.color} />
    ),
  },
  {
    accessorKey: "format",
    header: "Format",
    enableSorting: false,
    cell: ({ row }) => <FormatBadge format={row.original.format} />,
  },
  {
    accessorKey: "views",
    header: "Views",
    cell: ({ row }) => (
      <span className="flex items-center gap-1 tabular-nums">
        <Eye className="size-3 text-muted-foreground" />
        {formatNumber(row.original.views)}
      </span>
    ),
  },
  {
    accessorKey: "likes",
    header: "Likes",
    cell: ({ row }) => (
      <span className="flex items-center gap-1 tabular-nums">
        <Heart className="size-3 text-muted-foreground" />
        {formatNumber(row.original.likes)}
      </span>
    ),
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
    accessorKey: "postedAt",
    header: "Posted",
    cell: ({ row }) => (
      <span className="text-xs text-muted-foreground">
        {relativeDate(row.original.postedAt)}
      </span>
    ),
  },
  {
    id: "tier",
    header: "Tier",
    enableSorting: false,
    cell: ({ row }) => (
      <ViralTierBadge tier={getViralTier(row.original.views)} />
    ),
  },
  {
    id: "actions",
    header: "",
    enableSorting: false,
    cell: ({ row }) => {
      const url = `https://www.tiktok.com/@${row.original.account.username}/video/${row.original.tiktokVideoId}`;
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

const PAGE_SIZE = 50;

export function VideosClient({
  videos,
  apps,
  totalCount,
}: {
  videos: AllVideo[];
  apps: { id: string; name: string; color: string }[];
  totalCount: number;
}) {
  const [view, setView] = useState<"grid" | "list">("list");
  const [search, setSearch] = useState("");
  const [appFilter, setAppFilter] = useState("all");
  const [formatFilter, setFormatFilter] = useState("all");
  const [minViews, setMinViews] = useState("");
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    let result = videos;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (v) =>
          v.description.toLowerCase().includes(q) ||
          v.hashtags.some((h) => h.toLowerCase().includes(q)) ||
          (v.hook && v.hook.toLowerCase().includes(q))
      );
    }
    if (appFilter !== "all") {
      result = result.filter((v) => v.app.id === appFilter);
    }
    if (formatFilter !== "all") {
      result = result.filter((v) => v.format === formatFilter);
    }
    if (minViews) {
      const min = parseInt(minViews, 10);
      if (!isNaN(min)) {
        result = result.filter((v) => v.views >= min);
      }
    }
    return result;
  }, [videos, search, appFilter, formatFilter, minViews]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const formatOptions = Object.entries(FORMAT_LABELS) as [
    VideoFormat,
    string,
  ][];

  return (
    <div className="flex flex-col gap-4">
      <div className="relative max-w-xs">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Search description, hooks, or hashtags..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
          className="pl-8"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-3">
        <Filter className="size-4 text-muted-foreground shrink-0" />

        <LabeledSelect label="App" value={appFilter} onChange={(val) => { setAppFilter(val); setPage(0); }}>
          <SelectItem value="all">All Apps</SelectItem>
          {apps.map((app) => (
            <SelectItem key={app.id} value={app.id}>{app.name}</SelectItem>
          ))}
        </LabeledSelect>

        <LabeledSelect label="Format" value={formatFilter} onChange={(val) => { setFormatFilter(val); setPage(0); }}>
          <SelectItem value="all">All Formats</SelectItem>
          {formatOptions.map(([key, label]) => (
            <SelectItem key={key} value={key}>{label}</SelectItem>
          ))}
        </LabeledSelect>

        <Input
          type="number"
          placeholder="Min views..."
          value={minViews}
          onChange={(e) => {
            setMinViews(e.target.value);
            setPage(0);
          }}
          className="w-32 h-8 text-xs"
        />

        <div className="ml-auto">
          <ViewToggle view={view} onChange={setView} />
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Showing {paged.length} of {filtered.length} videos (total:{" "}
        {formatNumber(totalCount)})
      </p>

      {view === "grid" ? (
        <VideoGrid videos={paged} />
      ) : (
        <div className="overflow-x-auto">
          <DataTable columns={columns} data={paged} />
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <span className="text-xs text-muted-foreground">
            Page {page + 1} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
