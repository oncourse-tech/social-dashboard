import { db } from "@/lib/db";
import { VideosClient } from "./videos-client";

export default async function VideosPage() {
  const totalCount = await db.video.count();

  const videos = await db.video.findMany({
    include: {
      account: {
        select: {
          username: true,
          app: { select: { id: true, name: true, color: true } },
        },
      },
    },
    orderBy: { views: "desc" },
  });

  const apps = await db.app.findMany({
    select: { id: true, name: true, color: true },
    orderBy: { name: "asc" },
  });

  const mapped = videos.map((v) => ({
    id: v.id,
    tiktokVideoId: v.tiktokVideoId,
    description: v.description,
    hashtags: v.hashtags,
    thumbnailUrl: v.thumbnailUrl,
    postedAt: v.postedAt,
    views: v.views,
    likes: v.likes,
    comments: v.comments,
    shares: v.shares,
    format: v.format,
    account: { username: v.account.username },
    app: v.account.app,
  }));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">
        All Videos{" "}
        <span className="text-sm font-normal text-muted-foreground">
          ({totalCount.toLocaleString()})
        </span>
      </h1>
      <VideosClient videos={mapped} apps={apps} totalCount={totalCount} />
    </div>
  );
}
