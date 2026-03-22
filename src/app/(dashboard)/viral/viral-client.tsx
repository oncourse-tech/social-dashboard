"use client";

import { useState, useMemo } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { ExternalLink, Eye, Heart, ChevronDown, ChevronRight } from "lucide-react";
import { VideoGrid, type VideoCardData } from "@/components/video-grid";
import { DataTable } from "@/components/data-table";
import { ViewToggle } from "@/components/view-toggle";
import { AppBadge } from "@/components/app-badge";
import { FormatBadge } from "@/components/format-badge";
import { ViralTierBadge } from "@/components/viral-tier-badge";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  formatNumber,
  getViralTier,
  relativeDate,
  calcEngagementRate,
  formatEngagementRate,
} from "@/lib/utils";
import { FORMAT_LABELS } from "@/lib/constants";
import { type VideoFormat } from "@prisma/client";

type ViralVideo = VideoCardData & {
  hook: string | null;
  script: string | null;
  cta: string | null;
  account: { username: string };
  app: { id: string; name: string; color: string };
};

type SortOption = "views" | "likes" | "engagement" | "recent";

function HookCell({ video }: { video: ViralVideo }) {
  const hookText = video.hook || "";
  const fallbackText = !hookText
    ? (video.description || "").slice(0, 60)
    : "";
  const displayText = hookText || fallbackText;

  if (!displayText) {
    return <span className="text-xs text-muted-foreground italic">No hook</span>;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger className="text-left">
          <p
            className={`line-clamp-2 text-sm leading-snug ${
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
}

function ExpandedRow({ video }: { video: ViralVideo }) {
  return (
    <div className="px-4 py-3 space-y-2 bg-muted/30 text-sm">
      {video.script && (
        <div>
          <span className="font-medium text-muted-foreground">Script: </span>
          <span className="text-foreground">{video.script}</span>
        </div>
      )}
      {video.cta && (
        <div>
          <span className="font-medium text-muted-foreground">CTA: </span>
          <span className="text-foreground">{video.cta}</span>
        </div>
      )}
      {!video.script && !video.cta && (
        <span className="text-muted-foreground italic">
          No script or CTA data available
        </span>
      )}
    </div>
  );
}

export function ViralClient({
  videos,
  apps,
}: {
  videos: ViralVideo[];
  apps: { id: string; name: string; color: string }[];
}) {
  const [view, setView] = useState<"grid" | "list">("list");
  const [appFilter, setAppFilter] = useState("all");
  const [formatFilter, setFormatFilter] = useState("all");
  const [tierFilter, setTierFilter] = useState("all");
  const [dateRange, setDateRange] = useState("all");
  const [sortBy, setSortBy] = useState<SortOption>("views");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filtered = useMemo(() => {
    let result = videos;

    if (appFilter !== "all") {
      result = result.filter((v) => v.app.id === appFilter);
    }
    if (formatFilter !== "all") {
      result = result.filter((v) => v.format === formatFilter);
    }
    if (tierFilter !== "all") {
      result = result.filter((v) => {
        const tier = getViralTier(v.views);
        if (tierFilter === "50K+") return tier === "50K+";
        if (tierFilter === "10K+") return tier === "10K+" || tier === "50K+";
        if (tierFilter === "5K+") return tier !== null;
        return true;
      });
    }
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
      result = result.filter((v) => new Date(v.postedAt) >= cutoff);
    }

    // Sort
    const sorted = [...result];
    switch (sortBy) {
      case "views":
        sorted.sort((a, b) => b.views - a.views);
        break;
      case "likes":
        sorted.sort((a, b) => b.likes - a.likes);
        break;
      case "engagement":
        sorted.sort((a, b) => {
          const ea = calcEngagementRate(a.views, a.likes, a.comments, a.shares);
          const eb = calcEngagementRate(b.views, b.likes, b.comments, b.shares);
          return eb - ea;
        });
        break;
      case "recent":
        sorted.sort(
          (a, b) =>
            new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime()
        );
        break;
    }
    return sorted;
  }, [videos, appFilter, formatFilter, tierFilter, dateRange, sortBy]);

  const formatOptions = Object.entries(FORMAT_LABELS) as [VideoFormat, string][];

  return (
    <div className="flex flex-col gap-4">
      {/* Filter bar */}
      <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center md:gap-3">
        <Select value={appFilter} onValueChange={(val) => setAppFilter(val ?? "all")}>
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

        <Select value={formatFilter} onValueChange={(val) => setFormatFilter(val ?? "all")}>
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

        <Select value={tierFilter} onValueChange={(val) => setTierFilter(val ?? "all")}>
          <SelectTrigger>
            <SelectValue placeholder="All Tiers" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tiers</SelectItem>
            <SelectItem value="5K+">5K+</SelectItem>
            <SelectItem value="10K+">10K+</SelectItem>
            <SelectItem value="50K+">50K+</SelectItem>
          </SelectContent>
        </Select>

        <Select value={dateRange} onValueChange={(val) => setDateRange(val ?? "all")}>
          <SelectTrigger>
            <SelectValue placeholder="All Time" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Time</SelectItem>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
          </SelectContent>
        </Select>

        <Select value={sortBy} onValueChange={(val) => setSortBy((val as SortOption) ?? "views")}>
          <SelectTrigger>
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="views">Most Views</SelectItem>
            <SelectItem value="likes">Most Likes</SelectItem>
            <SelectItem value="engagement">Highest Engagement</SelectItem>
            <SelectItem value="recent">Most Recent</SelectItem>
          </SelectContent>
        </Select>

        <div className="md:ml-auto">
          <ViewToggle view={view} onChange={setView} />
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Showing {filtered.length} viral videos
      </p>

      {view === "grid" ? (
        <VideoGrid videos={filtered} />
      ) : (
        <div className="overflow-x-auto">
          <div className="rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="w-8 px-2 py-2"></th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground w-[40%]">
                    Hook
                  </th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">
                    Creator
                  </th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">
                    App
                  </th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">
                    Format
                  </th>
                  <th className="text-right px-3 py-2 font-medium text-muted-foreground">
                    Views
                  </th>
                  <th className="text-right px-3 py-2 font-medium text-muted-foreground">
                    Likes
                  </th>
                  <th className="text-right px-3 py-2 font-medium text-muted-foreground">
                    Eng. Rate
                  </th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">
                    Posted
                  </th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">
                    Tier
                  </th>
                  <th className="w-10 px-2 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={11}
                      className="h-24 text-center text-muted-foreground"
                    >
                      No results.
                    </td>
                  </tr>
                ) : (
                  filtered.map((video) => {
                    const isExpanded = expandedRows.has(video.id);
                    const engRate = calcEngagementRate(
                      video.views,
                      video.likes,
                      video.comments,
                      video.shares
                    );
                    const tier = getViralTier(video.views);
                    const tiktokUrl = `https://www.tiktok.com/@${video.account.username}/video/${video.tiktokVideoId}`;

                    return (
                      <tr key={video.id} className="group">
                        <td colSpan={11} className="p-0">
                          <div
                            className="flex items-center border-b border-border hover:bg-muted/30 cursor-pointer"
                            onClick={() => toggleRow(video.id)}
                          >
                            <div className="w-8 px-2 py-2.5 flex items-center justify-center">
                              {isExpanded ? (
                                <ChevronDown className="size-3.5 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="size-3.5 text-muted-foreground" />
                              )}
                            </div>
                            <div className="w-[40%] px-3 py-2.5">
                              <HookCell video={video} />
                            </div>
                            <div className="px-3 py-2.5">
                              <span className="font-medium text-xs">
                                @{video.account.username}
                              </span>
                            </div>
                            <div className="px-3 py-2.5">
                              <AppBadge
                                name={video.app.name}
                                color={video.app.color}
                              />
                            </div>
                            <div className="px-3 py-2.5">
                              <FormatBadge format={video.format} />
                            </div>
                            <div className="px-3 py-2.5 text-right">
                              <span className="flex items-center justify-end gap-1 tabular-nums text-xs">
                                <Eye className="size-3 text-muted-foreground" />
                                {formatNumber(video.views)}
                              </span>
                            </div>
                            <div className="px-3 py-2.5 text-right">
                              <span className="flex items-center justify-end gap-1 tabular-nums text-xs">
                                <Heart className="size-3 text-muted-foreground" />
                                {formatNumber(video.likes)}
                              </span>
                            </div>
                            <div className="px-3 py-2.5 text-right">
                              <span className="tabular-nums text-xs font-medium">
                                {formatEngagementRate(engRate)}
                              </span>
                            </div>
                            <div className="px-3 py-2.5">
                              <span className="text-xs text-muted-foreground">
                                {relativeDate(video.postedAt)}
                              </span>
                            </div>
                            <div className="px-3 py-2.5">
                              <ViralTierBadge tier={tier} />
                            </div>
                            <div className="w-10 px-2 py-2.5">
                              <a
                                href={tiktokUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center text-muted-foreground hover:text-foreground"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <ExternalLink className="size-4" />
                              </a>
                            </div>
                          </div>
                          {isExpanded && <ExpandedRow video={video} />}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
