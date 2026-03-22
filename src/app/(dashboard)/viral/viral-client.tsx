"use client";

import { useState, useMemo } from "react";
import { ExternalLink, Eye, Heart, ChevronDown, ChevronRight } from "lucide-react";
import { VideoGrid, type VideoCardData } from "@/components/video-grid";
import { ViewToggle } from "@/components/view-toggle";
import { AppBadge } from "@/components/app-badge";
import { FormatBadge } from "@/components/format-badge";
import { ViralTierBadge } from "@/components/viral-tier-badge";
// Select components imported via labeled-select
import { LabeledSelect, SelectItem } from "@/components/labeled-select";
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
  videoUrl?: string | null;
  account: { username: string };
  app: { id: string; name: string; color: string };
};

type SortOption = "views" | "likes" | "engagement" | "recent";

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

    if (appFilter !== "all") result = result.filter((v) => v.app.id === appFilter);
    if (formatFilter !== "all") result = result.filter((v) => v.format === formatFilter);
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
      const days = dateRange === "7d" ? 7 : dateRange === "30d" ? 30 : 90;
      const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      result = result.filter((v) => new Date(v.postedAt) >= cutoff);
    }

    const sorted = [...result];
    switch (sortBy) {
      case "views": sorted.sort((a, b) => b.views - a.views); break;
      case "likes": sorted.sort((a, b) => b.likes - a.likes); break;
      case "engagement": sorted.sort((a, b) =>
        calcEngagementRate(b.views, b.likes, b.comments, b.shares) -
        calcEngagementRate(a.views, a.likes, a.comments, a.shares)
      ); break;
      case "recent": sorted.sort((a, b) =>
        new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime()
      ); break;
    }
    return sorted;
  }, [videos, appFilter, formatFilter, tierFilter, dateRange, sortBy]);

  const formatOptions = Object.entries(FORMAT_LABELS) as [VideoFormat, string][];

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="rounded-lg border border-border bg-card p-3 space-y-3">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-5">
          <LabeledSelect label="App" value={appFilter} onChange={setAppFilter}>
            <SelectItem value="all">All Apps</SelectItem>
            {apps.map((app) => (
              <SelectItem key={app.id} value={app.id}>{app.name}</SelectItem>
            ))}
          </LabeledSelect>

          <LabeledSelect label="Format" value={formatFilter} onChange={setFormatFilter}>
            <SelectItem value="all">All Formats</SelectItem>
            {formatOptions.map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </LabeledSelect>

          <LabeledSelect label="Tier" value={tierFilter} onChange={setTierFilter}>
            <SelectItem value="all">All Tiers</SelectItem>
            <SelectItem value="5K+">5K+</SelectItem>
            <SelectItem value="10K+">10K+</SelectItem>
            <SelectItem value="50K+">50K+</SelectItem>
          </LabeledSelect>

          <LabeledSelect label="Period" value={dateRange} onChange={setDateRange}>
          <SelectItem value="all">All Time</SelectItem>
          <SelectItem value="7d">Last 7 days</SelectItem>
          <SelectItem value="30d">Last 30 days</SelectItem>
          <SelectItem value="90d">Last 90 days</SelectItem>
        </LabeledSelect>

          <LabeledSelect label="Sort" value={sortBy} onChange={(v) => setSortBy(v as SortOption)}>
            <SelectItem value="views">Most Views</SelectItem>
            <SelectItem value="likes">Most Likes</SelectItem>
            <SelectItem value="engagement">Engagement Rate</SelectItem>
            <SelectItem value="recent">Most Recent</SelectItem>
          </LabeledSelect>
        </div>

        <div className="flex items-center justify-between pt-1 border-t border-border/50">
          <p className="text-xs text-muted-foreground">
            {filtered.length} video{filtered.length !== 1 ? "s" : ""}
          </p>
          <ViewToggle view={view} onChange={setView} />
        </div>
      </div>

      {view === "grid" ? (
        <VideoGrid videos={filtered} />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[900px] table-fixed">
            <colgroup>
              <col style={{ width: "32px" }} />
              <col style={{ width: "30%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "7%" }} />
              <col style={{ width: "7%" }} />
              <col style={{ width: "6%" }} />
              <col style={{ width: "32px" }} />
            </colgroup>
            <thead>
              <tr className="border-b border-border bg-muted/40 text-xs font-medium text-muted-foreground">
                <th className="p-2" />
                <th className="p-2 text-left">Hook</th>
                <th className="p-2 text-left">Creator</th>
                <th className="p-2 text-left">App</th>
                <th className="p-2 text-left">Format</th>
                <th className="p-2 text-right">Views</th>
                <th className="p-2 text-right">Likes</th>
                <th className="p-2 text-right">Eng %</th>
                <th className="p-2 text-left">Posted</th>
                <th className="p-2 text-center">Tier</th>
                <th className="p-2" />
              </tr>
            </thead>
            <tbody className="text-sm">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={11} className="h-24 text-center text-muted-foreground">
                    No videos match your filters.
                  </td>
                </tr>
              ) : (
                filtered.flatMap((video) => {
                  const isExpanded = expandedRows.has(video.id);
                  const engRate = calcEngagementRate(video.views, video.likes, video.comments, video.shares);
                  const tier = getViralTier(video.views);
                  const hookText = video.hook || video.description?.slice(0, 80) || "";
                  const tiktokUrl = video.videoUrl || `https://www.tiktok.com/@${video.account.username}/video/${video.tiktokVideoId}`;

                  const rows = [
                    <tr
                      key={video.id}
                      className="border-b border-border hover:bg-muted/20 cursor-pointer transition-colors"
                      onClick={() => toggleRow(video.id)}
                    >
                      <td className="p-2 text-center align-middle">
                        {isExpanded
                          ? <ChevronDown className="size-3.5 text-muted-foreground mx-auto" />
                          : <ChevronRight className="size-3.5 text-muted-foreground mx-auto" />
                        }
                      </td>
                      <td className="p-2 align-middle">
                        <p className={`line-clamp-2 text-[13px] leading-snug ${video.hook ? "text-foreground" : "text-muted-foreground"}`}>
                          {hookText}
                        </p>
                      </td>
                      <td className="p-2 align-middle whitespace-nowrap">
                        <span className="text-xs font-medium">@{video.account.username}</span>
                      </td>
                      <td className="p-2 align-middle">
                        <AppBadge name={video.app.name} color={video.app.color} />
                      </td>
                      <td className="p-2 align-middle">
                        <FormatBadge format={video.format} />
                      </td>
                      <td className="p-2 text-right align-middle tabular-nums">
                        <span className="inline-flex items-center justify-end gap-1 text-xs">
                          <Eye className="size-3 text-muted-foreground" />
                          {formatNumber(video.views)}
                        </span>
                      </td>
                      <td className="p-2 text-right align-middle tabular-nums">
                        <span className="inline-flex items-center justify-end gap-1 text-xs">
                          <Heart className="size-3 text-muted-foreground" />
                          {formatNumber(video.likes)}
                        </span>
                      </td>
                      <td className="p-2 text-right align-middle">
                        <span className="text-xs font-semibold tabular-nums">
                          {formatEngagementRate(engRate)}
                        </span>
                      </td>
                      <td className="p-2 align-middle whitespace-nowrap">
                        <span className="text-xs text-muted-foreground">{relativeDate(video.postedAt)}</span>
                      </td>
                      <td className="p-2 text-center align-middle">
                        <ViralTierBadge tier={tier} />
                      </td>
                      <td className="p-2 text-center align-middle">
                        <a
                          href={tiktokUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-foreground"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink className="size-3.5" />
                        </a>
                      </td>
                    </tr>,
                  ];

                  if (isExpanded) {
                    rows.push(
                      <tr key={`${video.id}-detail`} className="bg-muted/10 border-b border-border">
                        <td />
                        <td colSpan={10} className="p-3">
                          <div className="space-y-1.5 text-xs">
                            {video.script && (
                              <div>
                                <span className="font-semibold text-muted-foreground">Script: </span>
                                <span>{video.script}</span>
                              </div>
                            )}
                            {video.cta && (
                              <div>
                                <span className="font-semibold text-muted-foreground">CTA: </span>
                                <span>{video.cta}</span>
                              </div>
                            )}
                            {!video.script && !video.cta && (
                              <span className="text-muted-foreground italic">No analysis data</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  return rows;
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

