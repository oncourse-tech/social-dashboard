"use client";

import { useEffect, useRef, useState } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import {
  ExternalLink,
  Eye,
  Heart,
  Search,
  Filter,
} from "lucide-react";
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
import { usePathname, useRouter } from "next/navigation";

type AllVideo = VideoCardData & {
  hook: string | null;
  script: string | null;
  cta: string | null;
  account: { username: string };
  app: { id: string; name: string; color: string };
};

type Filters = {
  search: string;
  app: string;
  format: string;
  minViews: string;
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

function updateQuery(
  router: ReturnType<typeof useRouter>,
  pathname: string,
  next: Partial<Filters> & { page?: number }
) {
  const params = new URLSearchParams(window.location.search);

  const set = (key: string, value: string | undefined) => {
    const trimmed = value?.trim() ?? "";
    if (!trimmed || trimmed === "all") params.delete(key);
    else params.set(key, trimmed);
  };

  if (next.search !== undefined) set("search", next.search);
  if (next.app !== undefined) set("app", next.app);
  if (next.format !== undefined) set("format", next.format);
  if (next.minViews !== undefined) set("minViews", next.minViews);

  if (next.page && next.page > 1) params.set("page", String(next.page));
  else params.delete("page");

  const query = params.toString();
  router.replace(query ? `${pathname}?${query}` : pathname);
}

export function VideosClient({
  videos,
  apps,
  totalCount,
  page,
  pageSize,
  filters,
}: {
  videos: AllVideo[];
  apps: { id: string; name: string; color: string }[];
  totalCount: number;
  page: number;
  pageSize: number;
  filters: Filters;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [view, setView] = useState<"grid" | "list">("list");
  const searchTimeout = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (searchTimeout.current !== null) {
        window.clearTimeout(searchTimeout.current);
      }
    };
  }, []);

  const formatOptions = Object.entries(FORMAT_LABELS) as [
    VideoFormat,
    string,
  ][];
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return (
    <div className="flex flex-col gap-4">
      <div className="relative max-w-xs">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          key={filters.search}
          placeholder="Search description, hooks, or hashtags..."
          defaultValue={filters.search}
          onChange={(e) => {
            if (searchTimeout.current !== null) {
              window.clearTimeout(searchTimeout.current);
            }
            const value = e.target.value;
            searchTimeout.current = window.setTimeout(() => {
              updateQuery(router, pathname, { search: value, page: 1 });
            }, 250);
          }}
          className="pl-8"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-3">
        <Filter className="size-4 text-muted-foreground shrink-0" />

        <LabeledSelect
          label="App"
          value={filters.app}
          onChange={(val) => {
            updateQuery(router, pathname, { app: val, page: 1 });
          }}
        >
          <SelectItem value="all">All Apps</SelectItem>
          {apps.map((app) => (
            <SelectItem key={app.id} value={app.id}>
              {app.name}
            </SelectItem>
          ))}
        </LabeledSelect>

        <LabeledSelect
          label="Format"
          value={filters.format}
          onChange={(val) => {
            updateQuery(router, pathname, { format: val, page: 1 });
          }}
        >
          <SelectItem value="all">All Formats</SelectItem>
          {formatOptions.map(([key, label]) => (
            <SelectItem key={key} value={key}>
              {label}
            </SelectItem>
          ))}
        </LabeledSelect>

        <Input
          type="number"
          placeholder="Min views..."
          value={filters.minViews}
          onChange={(e) => {
            updateQuery(router, pathname, { minViews: e.target.value, page: 1 });
          }}
          className="w-32 h-8 text-xs"
        />

        <div className="ml-auto">
          <ViewToggle view={view} onChange={setView} />
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Showing {videos.length} of {totalCount} videos
      </p>

      {view === "grid" ? (
        <VideoGrid videos={videos} />
      ) : (
        <div className="overflow-x-auto">
          <DataTable columns={columns} data={videos} />
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 1}
            onClick={() => updateQuery(router, pathname, { page: page - 1 })}
          >
            Previous
          </Button>
          <span className="text-xs text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => updateQuery(router, pathname, { page: page + 1 })}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
