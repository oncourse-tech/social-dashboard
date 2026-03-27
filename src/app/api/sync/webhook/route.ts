import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getDatasetItems } from "@/lib/apify";
// apify-client is marked as serverExternalPackages in next.config.ts
import { analyzeVideo } from "@/lib/gemini";
import { CACHE_TAGS, revalidateCacheTags } from "@/lib/cache";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const defaultDatasetId =
      body.resource?.defaultDatasetId ?? body.defaultDatasetId;

    if (!defaultDatasetId) {
      return NextResponse.json(
        { error: "Missing defaultDatasetId" },
        { status: 400 }
      );
    }

    const items = await getDatasetItems(defaultDatasetId);

    // Find the most recent RUNNING sync log (the trigger already created one)
    const syncLog = await db.syncLog.findFirst({
      where: { status: "RUNNING" },
      orderBy: { startedAt: "desc" },
    });

    // Fallback: create one if none found (e.g. manual webhook test)
    const syncLogId = syncLog
      ? syncLog.id
      : (await db.syncLog.create({ data: { status: "RUNNING" } })).id;

    let accountsSynced = 0;
    let videosSynced = 0;
    let newVideos = 0;
    const errors: Array<{ username: string; error: string }> = [];

    // The profile scraper returns a FLAT array of videos.
    // Each item is a video with authorMeta embedded.
    // Group items by username (authorMeta.name).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const itemsByUsername = new Map<string, Array<Record<string, any>>>();

    for (const rawItem of items) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const item = rawItem as Record<string, any>;
      const username = (item.authorMeta?.name ?? "") as string;
      if (!username) continue;

      if (!itemsByUsername.has(username)) {
        itemsByUsername.set(username, []);
      }
      itemsByUsername.get(username)!.push(item);
    }

    const trackedAccounts = await db.trackedAccount.findMany({
      where: { username: { in: [...itemsByUsername.keys()] } },
    });
    const accountsByUsername = new Map(
      trackedAccounts.map((account) => [account.username, account])
    );

    for (const [username, videoItems] of itemsByUsername) {
      try {
        const account = accountsByUsername.get(username);

        if (!account) continue;

        // Update account metrics from the first item's authorMeta
        const authorMeta = videoItems[0].authorMeta ?? {};
        const followers = (authorMeta.fans ?? account.followers) as number;
        const totalLikes = (authorMeta.heart ?? account.totalLikes) as number;
        const displayName = (authorMeta.nickName ??
          account.displayName) as string | null;
        const bio = (authorMeta.signature ?? account.bio) as string | null;
        const avatarUrl = (authorMeta.avatar ??
          account.avatarUrl) as string | null;
        const tiktokId = (authorMeta.id ?? account.tiktokId) as string | null;

        const reportedTotalVideos = Number(authorMeta.video ?? account.totalVideos);

        await db.trackedAccount.update({
          where: { id: account.id },
          data: {
            followers,
            totalLikes,
            displayName,
            bio,
            avatarUrl,
            tiktokId,
            totalVideos: reportedTotalVideos,
            lastSyncedAt: new Date(),
          },
        });

        // Create account snapshot
        await db.accountSnapshot.create({
          data: {
            accountId: account.id,
            followers,
            totalLikes,
            totalVideos: reportedTotalVideos,
          },
        });

        accountsSynced++;

        // Process each video item
        let latestPostedAt: Date | null = null;
        let accountNewVideos = 0;
        const tiktokVideoIds = videoItems
          .map((video) => String(video.id ?? ""))
          .filter(Boolean);
        const existingVideos = tiktokVideoIds.length
          ? await db.video.findMany({
              where: { tiktokVideoId: { in: tiktokVideoIds } },
              select: { id: true, tiktokVideoId: true },
            })
          : [];
        const existingVideosByTikTokId = new Map(
          existingVideos.map((video) => [video.tiktokVideoId, video])
        );

        for (const video of videoItems) {
          const tiktokVideoId = String(video.id ?? "");
          if (!tiktokVideoId) continue;

          const views = (video.playCount ?? 0) as number;
          const likes = (video.diggCount ?? 0) as number;
          const comments = (video.commentCount ?? 0) as number;
          const shares = (video.shareCount ?? 0) as number;
          const description = (video.text ?? "") as string;
          const hashtags = (
            (video.hashtags as Array<Record<string, string>> | undefined)?.map(
              (h) => h.name ?? ""
            ) ?? []
          ) as string[];
          const duration = (video.videoMeta?.duration ?? 0) as number;
          const musicName = (video.musicMeta?.musicName ?? null) as
            | string
            | null;
          const thumbnailUrl = (video.videoMeta?.coverUrl ?? null) as
            | string
            | null;
          const videoUrl = (video.webVideoUrl ?? null) as string | null;
          const postedAtRaw = video.createTimeISO;
          const postedAt = postedAtRaw ? new Date(String(postedAtRaw)) : new Date();
          const isCarousel = Boolean(video.imagePost ?? false);

          if (!latestPostedAt || postedAt > latestPostedAt) {
            latestPostedAt = postedAt;
          }

          // Check if video already exists
          const existing = existingVideosByTikTokId.get(tiktokVideoId);

          let videoRecordId: string;

          if (existing) {
            // Update existing video metrics
            await db.video.update({
              where: { id: existing.id },
              data: { views, likes, comments, shares },
            });
            videoRecordId = existing.id;
          } else {
            // Create new video
            const created = await db.video.create({
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
                accountId: account.id,
              },
            });
            videoRecordId = created.id;
            existingVideosByTikTokId.set(tiktokVideoId, created);
            newVideos++;
            accountNewVideos++;

            // Analyze video with Gemini (format, hook, script, CTA)
            const analysis = await analyzeVideo({
              description,
              hashtags,
              duration,
              musicName,
              thumbnailUrl,
              videoUrl,
            });

            await db.video.update({
              where: { id: created.id },
              data: {
                format: analysis.format,
                hook: analysis.hook,
                script: analysis.script,
                cta: analysis.cta,
                relevant: analysis.relevant,
              },
            });
          }

          // Create video snapshot for EVERY video (tracks daily engagement)
          await db.videoSnapshot.create({
            data: {
              videoId: videoRecordId,
              views,
              likes,
              comments,
              shares,
            },
          });

          videosSynced++;
        }

        // Update lastPostedAt and totalVideos
        await db.trackedAccount.update({
          where: { id: account.id },
          data: {
            ...(latestPostedAt ? { lastPostedAt: latestPostedAt } : {}),
            totalVideos: Math.max(reportedTotalVideos, account.totalVideos + accountNewVideos),
          },
        });
      } catch (err) {
        console.error(`Error processing ${username}:`, err);
        errors.push({
          username,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    // Update sync log
    await db.syncLog.update({
      where: { id: syncLogId },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        accountsSynced,
        videosSynced,
        newVideos,
        errors: errors.length > 0 ? errors : undefined,
      },
    });

    await revalidateCacheTags([
      CACHE_TAGS.sync,
      CACHE_TAGS.videos,
      CACHE_TAGS.appSummaries,
      CACHE_TAGS.accountSummaries,
    ]);

    return NextResponse.json({
      syncLogId,
      accountsSynced,
      videosSynced,
      newVideos,
      errors: errors.length,
    });
  } catch (error) {
    console.error("Webhook processing failed:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}
