import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const appId = searchParams.get("app");

  const settings = await db.settings.findFirst({ where: { id: "default" } });
  const threshold1 = settings?.viralThreshold1 ?? 5000;
  const threshold2 = settings?.viralThreshold2 ?? 50000;

  const accounts = await db.trackedAccount.findMany({
    where: appId ? { appId } : undefined,
    include: {
      app: { select: { id: true, name: true, color: true } },
      videos: {
        select: { views: true, postedAt: true },
      },
    },
    orderBy: { username: "asc" },
  });

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const result = accounts.map((account) => {
    let videos7d = 0;
    let viral5k = 0;
    let viral10k = 0;
    let viral50k = 0;

    for (const video of account.videos) {
      if (video.postedAt >= sevenDaysAgo) videos7d++;
      if (video.views >= threshold2) viral50k++;
      else if (video.views >= 10000) viral10k++;
      else if (video.views >= threshold1) viral5k++;
    }

    return {
      id: account.id,
      username: account.username,
      displayName: account.displayName,
      avatarUrl: account.avatarUrl,
      followers: account.followers,
      totalLikes: account.totalLikes,
      totalVideos: account.videos.length,
      lastPostedAt: account.lastPostedAt,
      lastSyncedAt: account.lastSyncedAt,
      trackingSince: account.trackingSince,
      app: account.app,
      videos7d,
      viral5k,
      viral10k,
      viral50k,
    };
  });

  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { username, appId } = body as { username: string; appId: string };

  if (!username || !appId) {
    return NextResponse.json(
      { error: "username and appId are required" },
      { status: 400 }
    );
  }

  const cleanUsername = username.replace(/^@/, "");

  const account = await db.trackedAccount.create({
    data: { username: cleanUsername, appId },
  });

  return NextResponse.json(account, { status: 201 });
}
