import { PrismaClient, VideoFormat } from "@prisma/client";
import { ApifyClient } from "apify-client";
import "dotenv/config";

const prisma = new PrismaClient();

// Simple format detection without Gemini (to avoid rate limits on 1000+ videos)
function detectFormat(item: Record<string, any>): VideoFormat {
  const desc = ((item.text ?? "") as string).toLowerCase();
  const isCarousel = Boolean(item.imagePost ?? false);

  if (isCarousel) return "CAROUSEL_SLIDESHOW";
  if (desc.includes("react") || desc.includes("reaction") || desc.includes("reacting"))
    return "UGC_REACTION";
  if (desc.includes("voiceover") || desc.includes("voice over") || desc.includes("pov"))
    return "UGC_VOICEOVER";
  return "OTHER";
}

async function main() {
  const datasetId = process.argv[2];
  if (!datasetId) {
    console.error("Usage: npx tsx scripts/process-dataset.ts <datasetId>");
    process.exit(1);
  }

  const token = process.env.APIFY_API_KEY;
  if (!token) throw new Error("APIFY_API_KEY not set");

  const client = new ApifyClient({ token });
  console.log(`Fetching dataset ${datasetId}...`);
  const { items } = await client.dataset(datasetId).listItems();
  console.log(`Got ${items.length} items`);

  // Group by username
  const itemsByUsername = new Map<string, Array<Record<string, any>>>();
  for (const rawItem of items) {
    const item = rawItem as Record<string, any>;
    const username = (item.authorMeta?.name ?? "") as string;
    if (!username) continue;
    if (!itemsByUsername.has(username)) itemsByUsername.set(username, []);
    itemsByUsername.get(username)!.push(item);
  }

  console.log(`Found ${itemsByUsername.size} unique creators`);

  // Clean up stuck sync logs
  await prisma.syncLog.updateMany({
    where: { status: "RUNNING" },
    data: { status: "FAILED", completedAt: new Date() },
  });

  const syncLog = await prisma.syncLog.create({
    data: { status: "RUNNING" },
  });

  let accountsSynced = 0;
  let videosSynced = 0;
  let newVideos = 0;

  for (const [username, videoItems] of itemsByUsername) {
    const account = await prisma.trackedAccount.findUnique({
      where: { username },
    });

    if (!account) {
      console.log(`  Skip @${username} — not tracked`);
      continue;
    }

    // Update account metadata
    const authorMeta = videoItems[0].authorMeta ?? {};
    await prisma.trackedAccount.update({
      where: { id: account.id },
      data: {
        followers: (authorMeta.fans ?? account.followers) as number,
        totalLikes: (authorMeta.heart ?? account.totalLikes) as number,
        displayName: (authorMeta.nickName ?? account.displayName) as string | null,
        bio: (authorMeta.signature ?? account.bio) as string | null,
        avatarUrl: (authorMeta.avatar ?? account.avatarUrl) as string | null,
        tiktokId: (authorMeta.id ?? account.tiktokId) as string | null,
        lastSyncedAt: new Date(),
      },
    });

    // Create account snapshot
    await prisma.accountSnapshot.create({
      data: {
        accountId: account.id,
        followers: (authorMeta.fans ?? account.followers) as number,
        totalLikes: (authorMeta.heart ?? account.totalLikes) as number,
        totalVideos: videoItems.length,
      },
    });

    accountsSynced++;
    let latestPostedAt: Date | null = null;

    for (const video of videoItems) {
      const tiktokVideoId = String(video.id ?? "");
      if (!tiktokVideoId) continue;

      const views = (video.playCount ?? 0) as number;
      const likes = (video.diggCount ?? 0) as number;
      const comments = (video.commentCount ?? 0) as number;
      const shares = (video.shareCount ?? 0) as number;
      const description = (video.text ?? "") as string;
      const hashtags = ((video.hashtags as Array<Record<string, string>> | undefined)?.map(
        (h) => h.name ?? ""
      ) ?? []) as string[];
      const duration = (video.videoMeta?.duration ?? 0) as number;
      const musicName = (video.musicMeta?.musicName ?? null) as string | null;
      const thumbnailUrl = (video.videoMeta?.coverUrl ?? null) as string | null;
      const videoUrl = (video.webVideoUrl ?? null) as string | null;
      const postedAtRaw = video.createTimeISO;
      const postedAt = postedAtRaw ? new Date(String(postedAtRaw)) : new Date();
      const isCarousel = Boolean(video.imagePost ?? false);

      if (!latestPostedAt || postedAt > latestPostedAt) latestPostedAt = postedAt;

      const existing = await prisma.video.findUnique({ where: { tiktokVideoId } });

      if (existing) {
        await prisma.video.update({
          where: { id: existing.id },
          data: { views, likes, comments, shares },
        });
        // Snapshot for existing
        await prisma.videoSnapshot.create({
          data: { videoId: existing.id, views, likes, comments, shares },
        });
        videosSynced++;
      } else {
        const format = detectFormat(video);
        const created = await prisma.video.create({
          data: {
            tiktokVideoId,
            description,
            hashtags,
            thumbnailUrl,
            videoUrl,
            duration,
            postedAt,
            views,
            likes,
            comments,
            shares,
            isCarousel,
            musicName,
            format,
            accountId: account.id,
          },
        });
        await prisma.videoSnapshot.create({
          data: { videoId: created.id, views, likes, comments, shares },
        });
        newVideos++;
        videosSynced++;
      }
    }

    if (latestPostedAt) {
      await prisma.trackedAccount.update({
        where: { id: account.id },
        data: { lastPostedAt: latestPostedAt, totalVideos: videoItems.length },
      });
    }

    console.log(`  @${username}: ${videoItems.length} videos (${accountsSynced} accounts done)`);
  }

  await prisma.syncLog.update({
    where: { id: syncLog.id },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
      accountsSynced,
      videosSynced,
      newVideos,
    },
  });

  console.log(`\nDone! ${accountsSynced} accounts, ${videosSynced} videos (${newVideos} new)`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("Error:", e);
  prisma.$disconnect();
  process.exit(1);
});
