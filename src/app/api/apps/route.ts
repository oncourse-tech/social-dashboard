import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const settings = await db.settings.findFirst({ where: { id: "default" } });
  const threshold1 = settings?.viralThreshold1 ?? 5000;
  const threshold2 = settings?.viralThreshold2 ?? 50000;

  const apps = await db.app.findMany({
    include: {
      trackedAccounts: {
        include: {
          videos: {
            select: { views: true, postedAt: true },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const result = apps.map((app) => {
    let totalFollowers = 0;
    let totalLikes = 0;
    let totalVideos = 0;
    let videos7d = 0;
    let viral5k = 0;
    let viral50k = 0;

    for (const account of app.trackedAccounts) {
      totalFollowers += account.followers;
      totalLikes += account.totalLikes;
      totalVideos += account.videos.length;

      for (const video of account.videos) {
        if (video.postedAt >= sevenDaysAgo) videos7d++;
        if (video.views >= threshold2) viral50k++;
        else if (video.views >= threshold1) viral5k++;
      }
    }

    return {
      id: app.id,
      name: app.name,
      color: app.color,
      url: app.url,
      accountCount: app.trackedAccounts.length,
      totalFollowers,
      totalLikes,
      totalVideos,
      videos7d,
      viral5k,
      viral50k,
    };
  });

  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, color, url } = body as {
    name: string;
    color: string;
    url?: string;
  };

  if (!name || !color) {
    return NextResponse.json(
      { error: "Name and color are required" },
      { status: 400 }
    );
  }

  const app = await db.app.create({
    data: { name, color, url: url || null },
  });

  return NextResponse.json(app, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  await db.app.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
