"use client";

import { useState } from "react";
import {
  ExternalLink,
  Eye,
  Heart,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { VideoGrid, type VideoCardData } from "@/components/video-grid";
import { ViewToggle } from "@/components/view-toggle";
import { AppBadge } from "@/components/app-badge";
import { FormatBadge } from "@/components/format-badge";
import { ViralTierBadge } from "@/components/viral-tier-badge";
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

const SORT_OPTIONS: SortOption[] = [
  "views",
  "likes",
  "engagement",
  "recent",
];

function readValue(
  searchParams: { get(name: string): string | null; toString(): string },
  key: string,
  fallback: string
) {
  return searchParams.get(key) ?? fallback;
}

export function ViralClient({
  videos,
  apps,
  page,
  pageCount,
  totalCount,
  pageStart,
  pageEnd,
}: {
  videos: ViralVideo[];
  apps: { id: string; name: string; color: string }[];
  page: number;
  pageCount: number;
  totalCount: number;
  pageStart: number;
  pageEnd: number;
}) {
  const [view, setView] = useState<"grid" | "list">("list");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const appFilter = readValue(searchParams, "app", "all");
  const formatFilter = Object.prototype.hasOwnProperty.call(
    FORMAT_LABELS,
    readValue(searchParams, "format", "all")
  )
    ? readValue(searchParams, "format", "all")
    : "all";
  const tierFilter = readValue(searchParams, "tier", "all");
  const dateRange = readValue(searchParams, "period", "all");
  const rawSort = readValue(searchParams, "sort", "views") as SortOption;
  const sortBy = SORT_OPTIONS.includes(rawSort) ? rawSort : "views";

  function navigate(
    updates: Record<string, string | null>,
    { resetPage = true }: { resetPage?: boolean } = {}
  ) {
    const next = new URLSearchParams(searchParams.toString());

    for (const [key, value] of Object.entries(updates)) {
      if (!value || value === "all") next.delete(key);
      else next.set(key, value);
    }

    if (resetPage) {
      next.delete("page");
    }

    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  }

  const formatOptions = Object.entries(FORMAT_LABELS) as [VideoFormat, string][];

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-card p-3 space-y-3">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-5">
          <LabeledSelect
            label="App"
            value={appFilter}
            onChange={(value) => navigate({ app: value })}
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
            value={formatFilter}
            onChange={(value) => navigate({ format: value })}
          >
            <SelectItem value="all">All Formats</SelectItem>
            {formatOptions.map(([key, label]) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            ))}
          </LabeledSelect>

          <LabeledSelect
            label="Tier"
            value={tierFilter}
            onChange={(value) => navigate({ tier: value })}
          >
            <SelectItem value="all">All Tiers</SelectItem>
            <SelectItem value="5K+">5K+</SelectItem>
            <SelectItem value="10K+">10K+</SelectItem>
            <SelectItem value="50K+">50K+</SelectItem>
          </LabeledSelect>

          <LabeledSelect
            label="Period"
            value={dateRange}
            onChange={(value) => navigate({ period: value })}
          >
            <SelectItem value="all">All Time</SelectItem>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
          </LabeledSelect>

          <LabeledSelect
            label="Sort"
            value={sortBy}
            onChange={(value) => navigate({ sort: value as SortOption })}
          >
            <SelectItem value="views">Most Views</SelectItem>
            <SelectItem value="likes">Most Likes</SelectItem>
            <SelectItem value="engagement">Engagement Rate</SelectItem>
            <SelectItem value="recent">Most Recent</SelectItem>
          </LabeledSelect>
        </div>

        <div className="flex items-center justify-between gap-3 pt-1 border-t border-border/50">
          <p className="text-xs text-muted-foreground">
            {videos.length} video{videos.length !== 1 ? "s" : ""} on this page
          </p>
          <ViewToggle view={view} onChange={setView} />
        </div>
      </div>

      {view === "grid" ? (
        <VideoGrid videos={videos} />
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
              {videos.length === 0 ? (
                <tr>
                  <td colSpan={11} className="h-24 text-center text-muted-foreground">
                    No videos match your filters.
                  </td>
                </tr>
              ) : (
                videos.flatMap((video) => {
                  const isExpanded = expandedRows.has(video.id);
                  const engRate = calcEngagementRate(
                    video.views,
                    video.likes,
                    video.comments,
                    video.shares
                  );
                  const tier = getViralTier(video.views);
                  const hookText = video.hook || video.description?.slice(0, 80) || "";
                  const tiktokUrl =
                    video.videoUrl ||
                    `https://www.tiktok.com/@${video.account.username}/video/${video.tiktokVideoId}`;

                  const rows = [
                    <tr
                      key={video.id}
                      className="cursor-pointer border-b border-border transition-colors hover:bg-muted/20"
                      onClick={() =>
                        setExpandedRows((prev) => {
                          const next = new Set(prev);
                          if (next.has(video.id)) next.delete(video.id);
                          else next.add(video.id);
                          return next;
                        })
                      }
                    >
                      <td className="p-2 text-center align-middle">
                        {isExpanded ? (
                          <ChevronDown className="mx-auto size-3.5 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="mx-auto size-3.5 text-muted-foreground" />
                        )}
                      </td>
                      <td className="p-2 align-middle">
                        <p
                          className={`line-clamp-2 text-[13px] leading-snug ${
                            video.hook ? "text-foreground" : "text-muted-foreground"
                          }`}
                        >
                          {hookText}
                        </p>
                      </td>
                      <td className="p-2 align-middle whitespace-nowrap">
                        <span className="text-xs font-medium">
                          @{video.account.username}
                        </span>
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
                        <span className="text-xs text-muted-foreground">
                          {relativeDate(video.postedAt)}
                        </span>
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
                      <tr
                        key={`${video.id}-detail`}
                        className="border-b border-border bg-muted/10"
                      >
                        <td />
                        <td colSpan={10} className="p-3">
                          <div className="space-y-1.5 text-xs">
                            {video.script && (
                              <div>
                                <span className="font-semibold text-muted-foreground">
                                  Script:{" "}
                                </span>
                                <span>{video.script}</span>
                              </div>
                            )}
                            {video.cta && (
                              <div>
                                <span className="font-semibold text-muted-foreground">
                                  CTA:{" "}
                                </span>
                                <span>{video.cta}</span>
                              </div>
                            )}
                            {!video.script && !video.cta && (
                              <span className="italic text-muted-foreground">
                                No analysis data
                              </span>
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

      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          {totalCount === 0
            ? "No matching videos."
            : `Showing ${pageStart.toLocaleString()}-${pageEnd.toLocaleString()} of ${totalCount.toLocaleString()} videos`}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => navigate({ page: String(page - 1) }, { resetPage: false })}
          >
            Previous
          </Button>
          <span className="text-xs text-muted-foreground">
            Page {page.toLocaleString()} of {pageCount.toLocaleString()}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= pageCount}
            onClick={() => navigate({ page: String(page + 1) }, { resetPage: false })}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
