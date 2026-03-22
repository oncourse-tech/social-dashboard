import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { analyzeVideo } from "@/lib/gemini";

// POST /api/classify — re-analyze videos with Gemini (format + hook + script + CTA)
// ?force=true to re-analyze all, otherwise only videos with format=OTHER
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
      videoUrl: true,
    },
    take: 50, // process in batches to avoid timeouts
  });

  let classified = 0;
  let failed = 0;

  for (const video of videos) {
    try {
      const analysis = await analyzeVideo({
        description: video.description,
        hashtags: video.hashtags,
        duration: video.duration,
        musicName: video.musicName,
        thumbnailUrl: video.thumbnailUrl,
        videoUrl: video.videoUrl,
      });

      await db.video.update({
        where: { id: video.id },
        data: {
          format: analysis.format,
          hook: analysis.hook,
          script: analysis.script,
          cta: analysis.cta,
        },
      });
      classified++;
    } catch {
      failed++;
    }
  }

  return NextResponse.json({
    total: videos.length,
    classified,
    failed,
  });
}
