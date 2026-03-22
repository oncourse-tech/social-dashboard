export const dynamic = 'force-dynamic';

import { db } from "@/lib/db";
import { SummaryCards } from "@/components/summary-cards";
import { Flame } from "lucide-react";
import { ViralClient } from "./viral-client";

export default async function ViralPage() {
  const settings = await db.settings.findFirst({ where: { id: "default" } });
  const threshold1 = settings?.viralThreshold1 ?? 5000;
  const threshold2 = settings?.viralThreshold2 ?? 50000;

  const videos = await db.video.findMany({
    where: { views: { gte: threshold1 } },
    include: {
      account: {
        select: {
          username: true,
          app: { select: { id: true, name: true, color: true } },
        },
      },
    },
    orderBy: { views: "desc" },
  });

  const apps = await db.app.findMany({
    select: { id: true, name: true, color: true },
    orderBy: { name: "asc" },
  });

  const totalViral = videos.length;
  const over5k = videos.filter((v) => v.views >= threshold1).length;
  const over50k = videos.filter((v) => v.views >= threshold2).length;

  const summaryItems = [
    { label: "Total Viral Videos", value: totalViral, icon: <Flame className="size-4" /> },
    { label: `>${formatThreshold(threshold1)} Views`, value: over5k, highlight: "#eab308" },
    { label: `>${formatThreshold(threshold2)} Views`, value: over50k, highlight: "#ef4444" },
  ];

  const mapped = videos.map((v) => ({
    id: v.id,
    tiktokVideoId: v.tiktokVideoId,
    description: v.description,
    hashtags: v.hashtags,
    thumbnailUrl: v.thumbnailUrl,
    postedAt: v.postedAt,
    views: v.views,
    likes: v.likes,
    comments: v.comments,
    shares: v.shares,
    format: v.format,
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

function formatThreshold(n: number): string {
  if (n >= 1000) return `${n / 1000}K`;
  return String(n);
}
