/**
 * Backfill Gemini analysis (format, hook, script, CTA) for videos missing analysis data.
 *
 * Usage:
 *   npx tsx scripts/backfill-analysis.ts              # process all unanalyzed videos
 *   npx tsx scripts/backfill-analysis.ts --limit 100  # process first 100
 *   npx tsx scripts/backfill-analysis.ts --viral-only  # only viral videos (5K+ views)
 */
import { PrismaClient } from "@prisma/client";
import { generateText, UserContent } from "ai";
import { google } from "@ai-sdk/google";
import { VideoFormat } from "@prisma/client";
import "dotenv/config";

const prisma = new PrismaClient();

const VALID_FORMATS = new Set(Object.values(VideoFormat));

const ANALYSIS_PROMPT = `You are an expert TikTok content analyst specializing in short-form video strategy for ed-tech and study apps.

## Post metadata:
- Caption: {description}
- Hashtags: {hashtags}
- Duration: {duration} seconds
- Sound: {musicName}

## Extract these four things:

### 1. FORMAT
Classify into exactly ONE category:
- **UGC_REACTION**: Creator reacting to something on screen (duets, stitches, split-screen reactions)
- **UGC_VOICEOVER**: Creator narrating over visuals (voiceover on screen recordings, app demos, slideshows)
- **CAROUSEL_SLIDESHOW**: Sequence of static images, text cards, infographic slides, tip lists
- **OTHER**: Does not clearly fit any category above

### 2. HOOK
The opening hook — exact first words spoken/shown in 1-3 seconds. If purely visual, describe in one sentence.

### 3. SCRIPT
Summarize the video's narrative arc in 2-3 sentences.

### 4. CTA
The call-to-action (explicit like "Follow for more" or implicit). Write "None" if no CTA.

## Response format
Respond with ONLY this JSON. No markdown, no code blocks:
{"format":"<FORMAT>","hook":"<HOOK>","script":"<SCRIPT>","cta":"<CTA>"}`;

async function analyzeVideo(video: {
  description: string;
  hashtags: string[];
  duration: number;
  musicName: string | null;
  thumbnailUrl: string | null;
}): Promise<{ format: VideoFormat; hook: string; script: string; cta: string }> {
  const promptText = ANALYSIS_PROMPT
    .replace("{description}", video.description || "No caption")
    .replace("{hashtags}", video.hashtags.join(", ") || "None")
    .replace("{duration}", String(video.duration))
    .replace("{musicName}", video.musicName ?? "Original sound");

  const userContent: UserContent = [];

  if (video.thumbnailUrl) {
    try {
      userContent.push({
        type: "file",
        data: new URL(video.thumbnailUrl),
        mediaType: "image/jpeg",
      });
    } catch {
      // invalid URL, skip image
    }
  }

  userContent.push({ type: "text", text: promptText });

  const { text } = await generateText({
    model: google("gemini-3.1-pro-preview"),
    messages: [{ role: "user" as const, content: userContent }],
  });

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return { format: "OTHER", hook: "", script: "", cta: "" };
  }

  const parsed = JSON.parse(jsonMatch[0]);
  return {
    format: VALID_FORMATS.has(parsed.format) ? (parsed.format as VideoFormat) : "OTHER",
    hook: parsed.hook || "",
    script: parsed.script || "",
    cta: parsed.cta || "",
  };
}

// Simple sleep utility
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const args = process.argv.slice(2);
  const limitArg = args.indexOf("--limit");
  const limit = limitArg !== -1 ? parseInt(args[limitArg + 1], 10) : undefined;
  const viralOnly = args.includes("--viral-only");

  // Find videos without analysis data
  const where: any = {
    hook: null,
  };
  if (viralOnly) {
    where.views = { gte: 5000 };
  }

  const videos = await prisma.video.findMany({
    where,
    orderBy: { views: "desc" }, // prioritize high-view videos
    take: limit,
    select: {
      id: true,
      description: true,
      hashtags: true,
      duration: true,
      musicName: true,
      thumbnailUrl: true,
      views: true,
      account: { select: { username: true } },
    },
  });

  const CONCURRENCY = 30;
  console.log(`Found ${videos.length} videos to analyze${viralOnly ? " (viral only)" : ""} (concurrency: ${CONCURRENCY})`);
  if (limit) console.log(`Processing first ${limit}`);

  let processed = 0;
  let errors = 0;

  async function processVideo(video: typeof videos[number]) {
    try {
      const analysis = await analyzeVideo({
        description: video.description,
        hashtags: video.hashtags,
        duration: video.duration,
        musicName: video.musicName,
        thumbnailUrl: video.thumbnailUrl,
      });

      await prisma.video.update({
        where: { id: video.id },
        data: {
          format: analysis.format,
          hook: analysis.hook,
          script: analysis.script,
          cta: analysis.cta,
        },
      });

      processed++;
      const hookPreview = (analysis.hook || "").slice(0, 50);
      console.log(
        `  [${processed}/${videos.length}] @${video.account.username} | ${video.views} views | ${analysis.format} | "${hookPreview}"`
      );
    } catch (err: any) {
      errors++;
      console.error(`  ERROR @${video.account.username} (${video.id}): ${err.message}`);
    }
  }

  // Process in batches of CONCURRENCY
  for (let i = 0; i < videos.length; i += CONCURRENCY) {
    const batch = videos.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map(processVideo));
    console.log(`  --- batch ${Math.floor(i / CONCURRENCY) + 1} complete (${Math.min(i + CONCURRENCY, videos.length)}/${videos.length}) ---`);
  }

  console.log(`\nDone! ${processed} analyzed, ${errors} errors.`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("Fatal:", e);
  prisma.$disconnect();
  process.exit(1);
});
