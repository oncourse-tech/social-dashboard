/**
 * Classify relevance for already-analyzed videos using Gemini.
 * Targets videos that have hook/script but haven't been relevance-classified yet.
 *
 * Usage:
 *   npx tsx scripts/classify-relevance.ts              # all videos with analysis
 *   npx tsx scripts/classify-relevance.ts --viral-only  # only viral (5K+)
 */
import { PrismaClient } from "@prisma/client";
import { generateText, UserContent } from "ai";
import { google } from "@ai-sdk/google";
import "dotenv/config";

const prisma = new PrismaClient();

const RELEVANCE_PROMPT = `You are classifying TikTok videos for a medical education competitor intelligence dashboard.

## Video metadata:
- Caption: {description}
- Hashtags: {hashtags}

## Task:
Is this video related to medical education, exam preparation (USMLE, MCAT, Step 1/2, board exams), study apps/resources, study tips, medical school life, clinical rotations, residency, or healthcare careers?

Answer ONLY "true" or "false":
- **true**: Video is about studying medicine, reviewing study resources, med school experiences, clinical content, exam prep, healthcare education, or medical humor that's clearly from/about the medical education world
- **false**: Video is lifestyle, fashion, cooking, entertainment, personal vlogs, politics, relationship content, or other content unrelated to medical education`;

async function classifyRelevance(description: string, hashtags: string[]): Promise<boolean> {
  const prompt = RELEVANCE_PROMPT
    .replace("{description}", description || "No caption")
    .replace("{hashtags}", hashtags.join(", ") || "None");

  const { text } = await generateText({
    model: google("gemini-2.0-flash"),
    messages: [{ role: "user", content: prompt }],
  });

  return text.trim().toLowerCase().includes("true");
}

async function main() {
  const viralOnly = process.argv.includes("--viral-only");

  const where: any = {
    hook: { not: null }, // already analyzed
  };
  if (viralOnly) {
    where.views = { gte: 5000 };
  }

  const videos = await prisma.video.findMany({
    where,
    orderBy: { views: "desc" },
    select: {
      id: true,
      description: true,
      hashtags: true,
      views: true,
      account: { select: { username: true } },
    },
  });

  const CONCURRENCY = 50; // flash model can handle higher concurrency
  console.log(`Classifying relevance for ${videos.length} videos (concurrency: ${CONCURRENCY})`);

  let processed = 0;
  let relevant = 0;
  let irrelevant = 0;

  async function processVideo(video: typeof videos[number]) {
    try {
      const isRelevant = await classifyRelevance(video.description, video.hashtags);

      await prisma.video.update({
        where: { id: video.id },
        data: { relevant: isRelevant },
      });

      processed++;
      if (isRelevant) relevant++;
      else irrelevant++;

      const mark = isRelevant ? "✓" : "✗";
      console.log(
        `  [${processed}/${videos.length}] ${mark} @${video.account.username} | ${video.views} views | ${(video.description || "").slice(0, 60)}`
      );
    } catch (err: any) {
      processed++;
      console.error(`  ERROR @${video.account.username}: ${err.message}`);
    }
  }

  for (let i = 0; i < videos.length; i += CONCURRENCY) {
    const batch = videos.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map(processVideo));
    console.log(`  --- batch ${Math.floor(i / CONCURRENCY) + 1} (${Math.min(i + CONCURRENCY, videos.length)}/${videos.length}) | relevant: ${relevant} irrelevant: ${irrelevant} ---`);
  }

  console.log(`\nDone! ${relevant} relevant, ${irrelevant} irrelevant out of ${processed} videos.`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("Fatal:", e);
  prisma.$disconnect();
  process.exit(1);
});
