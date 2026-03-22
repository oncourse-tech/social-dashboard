import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getDatasetItems } from "@/lib/apify";
import { classifyVideoFormat } from "@/lib/gemini";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const defaultDatasetId = body.resource?.defaultDatasetId ?? body.defaultDatasetId;

    if (!defaultDatasetId) {
      return NextResponse.json(
        { error: "Missing defaultDatasetId" },
        { status: 400 }
      );
    }

    const items = await getDatasetItems(defaultDatasetId);

    // Find or create a sync log for this webhook
    const syncLog = await db.syncLog.create({
      data: { status: "RUNNING" },
    });

    let accountsSynced = 0;
    let videosSynced = 0;
    let newVideos = 0;
    const errors: Array<{ username: string; error: string }> = [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const rawItem of items) {
      const item = rawItem as Record<string, any>;
      try {
        const username = (item.uniqueId ?? item.authorMeta?.name ?? "") as string;
        if (!username) continue;

        const account = await db.trackedAccount.findUnique({
          where: { username },
        });

        if (!account) continue;

        // Update account metrics
        const followers = (item.authorMeta?.fans ?? item.fans ?? account.followers) as number;
        const totalLikes = (item.authorMeta?.heart ?? item.heart ?? account.totalLikes) as number;
        const totalVideos = (item.authorMeta?.video ?? item.video ?? account.totalVideos) as number;
        const displayName = (item.authorMeta?.nickName ?? item.nickname ?? account.displayName) as string | null;
        const bio = (item.authorMeta?.signature ?? item.signature ?? account.bio) as string | null;
        const avatarUrl = (item.authorMeta?.avatar ?? item.avatarMedium ?? account.avatarUrl) as string | null;
        const tiktokId = (item.authorMeta?.id ?? item.id ?? account.tiktokId) as string | null;

        await db.trackedAccount.update({
          where: { id: account.id },
          data: {
            followers,
            totalLikes,
            totalVideos,
            displayName,
            bio,
            avatarUrl,
            tiktokId,
            lastSyncedAt: new Date(),
          },
        });

        // Create account snapshot
        await db.accountSnapshot.create({
          data: {
            accountId: account.id,
            followers,
            totalLikes,
            totalVideos,
          },
        });

        accountsSynced++;

        // Process videos
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const videos = (item.latestVideos ?? item.videos ?? []) as Array<Record<string, any>>;

        let latestPostedAt: Date | null = null;

        for (const video of videos) {
          const tiktokVideoId = String(video.id ?? video.videoId ?? "");
          if (!tiktokVideoId) continue;

          const views = (video.playCount ?? video.views ?? 0) as number;
          const likes = (video.diggCount ?? video.likes ?? 0) as number;
          const comments = (video.commentCount ?? video.comments ?? 0) as number;
          const shares = (video.shareCount ?? video.shares ?? 0) as number;
          const description = (video.text ?? video.description ?? "") as string;
          const hashtags = ((video.hashtags as Array<Record<string, string>> | undefined)?.map(
            (h) => h.name ?? h.title ?? ""
          ) ?? []) as string[];
          const duration = (video.videoMeta?.duration ?? video.duration ?? 0) as number;
          const musicName = (video.musicMeta?.musicName ?? video.music?.title ?? null) as string | null;
          const thumbnailUrl = (video.videoMeta?.coverUrl ?? video.covers?.default ?? null) as string | null;
          const videoUrl = (video.videoUrl ?? video.videoMeta?.downloadAddr ?? null) as string | null;
          const postedAtRaw = video.createTimeISO ?? video.createTime;
          const postedAt = postedAtRaw
            ? new Date(typeof postedAtRaw === "number" ? postedAtRaw * 1000 : String(postedAtRaw))
            : new Date();
          const isCarousel = Boolean(video.imagePost ?? video.isCarousel ?? false);

          if (!latestPostedAt || postedAt > latestPostedAt) {
            latestPostedAt = postedAt;
          }

          // Check if video already exists
          const existing = await db.video.findUnique({
            where: { tiktokVideoId },
          });

          let videoRecordId: string;

          if (existing) {
            // Update existing video
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
            newVideos++;

            // Classify format for new videos
            const format = await classifyVideoFormat({
              description,
              hashtags,
              duration,
              musicName,
              thumbnailUrl,
            });

            await db.video.update({
              where: { id: created.id },
              data: { format },
            });
          }

          // Create video snapshot
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

        // Update lastPostedAt
        if (latestPostedAt) {
          await db.trackedAccount.update({
            where: { id: account.id },
            data: { lastPostedAt: latestPostedAt },
          });
        }
      } catch (err) {
        const username = (item.uniqueId ?? "unknown") as string;
        console.error(`Error processing ${username}:`, err);
        errors.push({
          username,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    // Update sync log
    await db.syncLog.update({
      where: { id: syncLog.id },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        accountsSynced,
        videosSynced,
        newVideos,
        errors: errors.length > 0 ? errors : undefined,
      },
    });

    return NextResponse.json({
      syncLogId: syncLog.id,
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
