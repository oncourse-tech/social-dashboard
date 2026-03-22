export const dynamic = 'force-dynamic';

import { db } from "@/lib/db";
import { SummaryCards } from "@/components/summary-cards";
import { Flame, TrendingUp, BarChart3, CalendarClock } from "lucide-react";
import { ViralClient } from "./viral-client";
import { calcEngagementRate } from "@/lib/utils";
import { FORMAT_LABELS } from "@/lib/constants";
import { type VideoFormat } from "@prisma/client";

export default async function ViralPage() {
  const settings = await db.settings.findFirst({ where: { id: "default" } });
  const threshold1 = settings?.viralThreshold1 ?? 5000;
  const threshold2 = settings?.viralThreshold2 ?? 50000;

  const videos = await db.video.findMany({
    where: { views: { gte: threshold1 } },
    include: {
      account: {
        include: { app: { select: { id: true, name: true, color: true } } },
      },
    },
    orderBy: { views: "desc" },
  });

  const apps = await db.app.findMany({
    select: { id: true, name: true, color: true },
    orderBy: { name: "asc" },
  });

  const totalViral = videos.length;

  // Avg engagement rate
  const engRates = videos.map((v) =>
    calcEngagementRate(v.views, v.likes, v.comments, v.shares)
  );
  const avgEngRate =
    engRates.length > 0
      ? engRates.reduce((a, b) => a + b, 0) / engRates.length
      : 0;

  // Top format
  const formatCounts: Record<string, number> = {};
  for (const v of videos) {
    formatCounts[v.format] = (formatCounts[v.format] || 0) + 1;
  }
  const topFormat = Object.entries(formatCounts).sort(
    (a, b) => b[1] - a[1]
  )[0];
  const topFormatLabel = topFormat
    ? FORMAT_LABELS[topFormat[0] as VideoFormat]
    : "N/A";

  // Videos this week
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const videosThisWeek = videos.filter(
    (v) => new Date(v.postedAt) >= sevenDaysAgo
  ).length;

  const summaryItems = [
    {
      label: "Total Viral Videos",
      value: totalViral,
      icon: <Flame className="size-4" />,
    },
    {
      label: "Avg Engagement Rate",
      value: Math.round(avgEngRate * 10) / 10,
      icon: <TrendingUp className="size-4" />,
      suffix: "%",
    },
    {
      label: `Top Format`,
      value: 0,
      icon: <BarChart3 className="size-4" />,
      textValue: topFormatLabel,
    },
    {
      label: "Videos This Week",
      value: videosThisWeek,
      icon: <CalendarClock className="size-4" />,
    },
  ];

  const mapped = videos.map((v) => ({
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
    format: v.format,
    hook: v.hook,
    script: v.script,
    cta: v.cta,
    account: { username: v.account.username },
    app: v.account.app,
  }));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Viral Videos</h1>
      <SummaryCards items={summaryItems} />
      <ViralClient videos={mapped} apps={apps} />
    </div>
  );
}
