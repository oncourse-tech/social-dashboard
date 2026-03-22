"use client";

import { useState, useMemo } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { ExternalLink, Search } from "lucide-react";
import { VideoFormat } from "@prisma/client";
import { ViewToggle } from "@/components/view-toggle";
import { VideoGrid, type VideoCardData } from "@/components/video-grid";
import { DataTable } from "@/components/data-table";
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

const listColumns: ColumnDef<VideoCardData, unknown>[] = [
  {
    accessorKey: "description",
    header: "Description",
    cell: ({ row }) => (
      <span className="line-clamp-1 max-w-[200px]">
        {row.original.description || "No description"}
      </span>
    ),
  },
  {
    accessorKey: "postedAt",
    header: "Posted",
    cell: ({ row }) => formatDate(row.original.postedAt),
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
  videos: VideoCardData[];
  username: string;
}) {
  const [view, setView] = useState<"grid" | "list">("grid");
  const [search, setSearch] = useState("");
  const [formatFilter, setFormatFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    return videos.filter((v) => {
      if (formatFilter !== "all" && v.format !== formatFilter) return false;
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        v.description.toLowerCase().includes(q) ||
        v.hashtags.some((h) => h.toLowerCase().includes(q))
      );
    });
  }, [videos, search, formatFilter]);

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

      <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
        <div className="relative flex-1 md:max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search description or hashtag..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={formatFilter} onValueChange={(val) => setFormatFilter(val ?? "all")}>
          <SelectTrigger>
            <SelectValue placeholder="All Formats" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Formats</SelectItem>
            {FORMAT_OPTIONS.map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
