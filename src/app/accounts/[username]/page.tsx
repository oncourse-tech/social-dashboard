export const dynamic = 'force-dynamic';

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

export default async function AccountDetailPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;

  const settings = await db.settings.findFirst({ where: { id: "default" } });
  const threshold1 = settings?.viralThreshold1 ?? 5000;
  const threshold2 = settings?.viralThreshold2 ?? 50000;

  const account = await db.trackedAccount.findUnique({
    where: { username },
    include: {
      app: { select: { id: true, name: true, color: true } },
      videos: {
        orderBy: { postedAt: "desc" },
      },
    },
  });

  if (!account) return notFound();

  let viral5k = 0;
  let viral10k = 0;
  let viral50k = 0;

  for (const video of account.videos) {
    if (video.views >= threshold2) viral50k++;
    else if (video.views >= 10000) viral10k++;
    else if (video.views >= threshold1) viral5k++;
  }

  const viralTotal = viral5k + viral10k + viral50k;

  const summaryItems = [
    { label: "Followers", value: account.followers },
    { label: "Total Likes", value: account.totalLikes },
    { label: "Total Videos", value: account.videos.length },
    { label: "Viral Videos", value: viralTotal },
  ];

  const videosData = account.videos.map((v) => ({
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
    account: { username: account.username },
  }));

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-4">
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
            <h1 className="text-xl font-semibold">@{account.username}</h1>
            <AppBadge
              name={account.app.name}
              color={account.app.color}
            />
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span>
              Tracking since {formatDate(account.trackingSince)}
            </span>
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
      </div>

      {/* Stats */}
      <SummaryCards items={summaryItems} />

      {/* Viral tier breakdown */}
      {viralTotal > 0 && (
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
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

      {/* Videos */}
      <AccountVideos
        videos={videosData}
        username={account.username}
      />
    </div>
  );
}
