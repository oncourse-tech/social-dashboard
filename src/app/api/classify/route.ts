import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { classifyVideoFormat } from "@/lib/gemini";

// POST /api/classify — re-classify all videos with format=OTHER (or all if ?force=true)
export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const force = searchParams.get("force") === "true";

  const where = force ? {} : { format: "OTHER" as const };
  const videos = await db.video.findMany({
    where,
    select: {
      id: true,
      description: true,
      hashtags: true,
      duration: true,
      musicName: true,
      thumbnailUrl: true,
    },
    take: 200, // process in batches
  });

  let classified = 0;
  let failed = 0;

  for (const video of videos) {
    try {
      const format = await classifyVideoFormat({
        description: video.description,
        hashtags: video.hashtags,
        duration: video.duration,
        musicName: video.musicName,
        thumbnailUrl: video.thumbnailUrl,
      });

      if (format !== "OTHER") {
        await db.video.update({
          where: { id: video.id },
          data: { format },
        });
        classified++;
      }

      // Throttle to avoid rate limits
      await new Promise((r) => setTimeout(r, 500));
    } catch {
      failed++;
    }
  }

  return NextResponse.json({
    total: videos.length,
    classified,
    failed,
    remaining: videos.length - classified - failed,
  });
}
