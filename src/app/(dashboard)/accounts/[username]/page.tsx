export const dynamic = 'force-dynamic';

import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { db } from "@/lib/db";
import { SummaryCards } from "@/components/summary-cards";
import { AppBadge } from "@/components/app-badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { AccountVideos } from "./account-videos";
import type { VideoFormat } from "@prisma/client";

const PAGE_SIZE = 50;

export default async function AccountDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { username } = await params;
  const paramsSearch = await searchParams;
  const requestedPage = Number.parseInt(paramsSearch.page ?? "1", 10);
  const currentPage = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;

  const settings = await db.settings.findFirst({ where: { id: "default" } });
  const threshold1 = settings?.viralThreshold1 ?? 5000;
  const threshold2 = settings?.viralThreshold2 ?? 50000;

  const account = await db.trackedAccount.findUnique({
    where: { username },
    select: {
      id: true,
      username: true,
      displayName: true,
      avatarUrl: true,
      followers: true,
      totalLikes: true,
      trackingSince: true,
      app: { select: { id: true, name: true, color: true } },
    },
  });

  if (!account) return notFound();

  const [totalVideos, viral5k, viral10k, viral50k] = await Promise.all([
    db.video.count({ where: { accountId: account.id } }),
    db.video.count({
      where: { accountId: account.id, views: { gte: threshold1, lt: 10000 } },
    }),
    db.video.count({
      where: { accountId: account.id, views: { gte: 10000, lt: threshold2 } },
    }),
    db.video.count({
      where: { accountId: account.id, views: { gte: threshold2 } },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalVideos / PAGE_SIZE));
  const page = Math.min(currentPage, totalPages);
  const skip = (page - 1) * PAGE_SIZE;

  const videos = await db.video.findMany({
    where: { accountId: account.id },
    orderBy: { postedAt: "desc" },
    skip,
    take: PAGE_SIZE,
  });

  const viralTotal = viral5k + viral10k + viral50k;

  const summaryItems = [
    { label: "Followers", value: account.followers },
    { label: "Total Likes", value: account.totalLikes },
    { label: "Total Videos", value: totalVideos },
    { label: "Viral Videos", value: viralTotal },
  ];

  const videosData = videos.map((v) => ({
    id: v.id,
    tiktokVideoId: v.tiktokVideoId,
    description: v.description,
    hashtags: v.hashtags,
    thumbnailUrl: v.thumbnailUrl,
    postedAt: v.postedAt.toISOString(),
    views: v.views,
    likes: v.likes,
    comments: v.comments,
    shares: v.shares,
    format: v.format as VideoFormat,
    hook: v.hook,
    script: v.script,
    cta: v.cta,
    account: { username: account.username },
  }));

  const prevPage = Math.max(1, page - 1);
  const nextPage = Math.min(totalPages, page + 1);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col items-start gap-3 md:flex-row md:items-center md:gap-4">
        <Avatar size="lg">
          {account.avatarUrl ? (
            <AvatarImage src={account.avatarUrl} alt={account.username} />
          ) : null}
          <AvatarFallback>
            {account.username.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h1 className="text-lg md:text-xl font-semibold">@{account.username}</h1>
            <AppBadge
              name={account.app.name}
              color={account.app.color}
            />
          </div>
          <p className="text-sm text-muted-foreground">
            Tracking since {formatDate(account.trackingSince)}
          </p>
          <a
            href={`https://www.tiktok.com/@${account.username}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="ghost" size="xs">
              <ExternalLink className="size-3" data-icon="inline-start" />
              View on TikTok
            </Button>
          </a>
        </div>
      </div>

      {/* Stats */}
      <SummaryCards items={summaryItems} />

      {/* Viral tier breakdown */}
      {viralTotal > 0 && (
        <div className="flex flex-wrap items-center gap-2 md:gap-4 text-sm text-muted-foreground">
          <span>Viral breakdown:</span>
          {viral5k > 0 && (
            <span className="text-yellow-400">{viral5k} at 5K+</span>
          )}
          {viral10k > 0 && (
            <span className="text-orange-400">{viral10k} at 10K+</span>
          )}
          {viral50k > 0 && (
            <span className="text-red-400">{viral50k} at 50K+</span>
          )}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3 text-sm">
          <span className="text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <div className="flex items-center gap-2">
            {page === 1 ? (
              <Button variant="outline" size="sm" disabled>Previous</Button>
            ) : (
              <Link href={`/accounts/${account.username}?page=${prevPage}`}>
                <Button variant="outline" size="sm">Previous</Button>
              </Link>
            )}
            {page === totalPages ? (
              <Button variant="outline" size="sm" disabled>Next</Button>
            ) : (
              <Link href={`/accounts/${account.username}?page=${nextPage}`}>
                <Button variant="outline" size="sm">Next</Button>
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Videos */}
      <AccountVideos
        videos={videosData}
        username={account.username}
      />
    </div>
  );
}
