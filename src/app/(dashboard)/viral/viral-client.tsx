"use client";

import { useState, useMemo } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { ExternalLink, Eye, Heart, MessageCircle, Share2 } from "lucide-react";
import { VideoGrid, type VideoCardData } from "@/components/video-grid";
import { DataTable } from "@/components/data-table";
import { ViewToggle } from "@/components/view-toggle";
import { AppBadge } from "@/components/app-badge";
import { FormatBadge } from "@/components/format-badge";
import { ViralTierBadge } from "@/components/viral-tier-badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatNumber, formatDate, getViralTier } from "@/lib/utils";
import { FORMAT_LABELS } from "@/lib/constants";
import { type VideoFormat } from "@prisma/client";

type ViralVideo = VideoCardData & {
  account: { username: string };
  app: { id: string; name: string; color: string };
};

const columns: ColumnDef<ViralVideo, unknown>[] = [
  {
    accessorKey: "description",
    header: "Description",
    enableSorting: false,
    cell: ({ row }) => (
      <p className="line-clamp-1 max-w-[200px] text-xs">
        {row.original.description || "No description"}
      </p>
    ),
  },
  {
    accessorKey: "account",
    header: "Creator",
    enableSorting: false,
    cell: ({ row }) => (
      <span className="font-medium text-xs">@{row.original.account.username}</span>
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
    accessorKey: "comments",
    header: "Comments",
    cell: ({ row }) => (
      <span className="flex items-center gap-1 tabular-nums">
        <MessageCircle className="size-3 text-muted-foreground" />
        {formatNumber(row.original.comments)}
      </span>
    ),
  },
  {
    accessorKey: "shares",
    header: "Shares",
    cell: ({ row }) => (
      <span className="flex items-center gap-1 tabular-nums">
        <Share2 className="size-3 text-muted-foreground" />
        {formatNumber(row.original.shares)}
      </span>
    ),
  },
  {
    accessorKey: "format",
    header: "Format",
    enableSorting: false,
    cell: ({ row }) => <FormatBadge format={row.original.format} />,
  },
  {
    accessorKey: "postedAt",
    header: "Posted",
    cell: ({ row }) => (
      <span className="text-xs text-muted-foreground">
        {formatDate(row.original.postedAt)}
      </span>
    ),
  },
  {
    id: "tier",
    header: "Tier",
    enableSorting: false,
    cell: ({ row }) => <ViralTierBadge tier={getViralTier(row.original.views)} />,
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

export function ViralClient({
  videos,
  apps,
}: {
  videos: ViralVideo[];
  apps: { id: string; name: string; color: string }[];
}) {
  const [view, setView] = useState<"grid" | "list">("grid");
  const [appFilter, setAppFilter] = useState("all");
  const [formatFilter, setFormatFilter] = useState("all");
  const [minViews, setMinViews] = useState("");

  const filtered = useMemo(() => {
    let result = videos;
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
    return result.sort((a, b) => b.views - a.views);
  }, [videos, appFilter, formatFilter, minViews]);

  const formatOptions = Object.entries(FORMAT_LABELS) as [VideoFormat, string][];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center md:gap-3">
        <Select
          value={appFilter}
          onValueChange={(val: string | null) => setAppFilter(val ?? "all")}
        >
          <SelectTrigger>
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

        <Select
          value={formatFilter}
          onValueChange={(val: string | null) => setFormatFilter(val ?? "all")}
        >
          <SelectTrigger>
            <SelectValue placeholder="All Formats" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Formats</SelectItem>
            {formatOptions.map(([key, label]) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          type="number"
          placeholder="Min views..."
          value={minViews}
          onChange={(e) => setMinViews(e.target.value)}
          className="w-32"
        />

        <div className="md:ml-auto">
          <ViewToggle view={view} onChange={setView} />
        </div>
      </div>

      {view === "grid" ? (
        <VideoGrid videos={filtered} />
      ) : (
        <div className="overflow-x-auto">
          <DataTable columns={columns} data={filtered} />
        </div>
      )}
    </div>
  );
}
