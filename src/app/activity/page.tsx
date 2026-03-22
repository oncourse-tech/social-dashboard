export const dynamic = 'force-dynamic';

import { db } from "@/lib/db";
import { ActivityClient } from "./activity-client";

export default async function ActivityPage() {
  const videos = await db.video.findMany({
    select: { postedAt: true },
  });

  const apps = await db.app.findMany({
    select: { id: true, name: true, color: true },
    orderBy: { name: "asc" },
  });

  // Build heatmap: key = "dayIdx-hour", value = count
  // dayIdx: 0=Mon, 1=Tue, ..., 6=Sun
  const heatmap: Record<string, number> = {};

  for (const video of videos) {
    const date = new Date(video.postedAt);
    // getDay() returns 0=Sun, 1=Mon, ..., 6=Sat
    // Convert to 0=Mon, ..., 6=Sun
    const jsDay = date.getUTCDay();
    const dayIdx = jsDay === 0 ? 6 : jsDay - 1;
    const hour = date.getUTCHours();
    const key = `${dayIdx}-${hour}`;
    heatmap[key] = (heatmap[key] ?? 0) + 1;
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Posting Activity</h1>
      <ActivityClient heatmap={heatmap} apps={apps} />
    </div>
  );
}
