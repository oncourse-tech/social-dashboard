import Image from "next/image";
import { Eye, Heart, MessageCircle, Share2 } from "lucide-react";
import { formatNumber, formatDate, getViralTier } from "@/lib/utils";
import { FormatBadge } from "@/components/format-badge";
import { ViralTierBadge } from "@/components/viral-tier-badge";
import { type VideoFormat } from "@prisma/client";

export type VideoCardData = {
  id: string;
  tiktokVideoId: string;
  description: string;
  hashtags: string[];
  thumbnailUrl: string | null;
  postedAt: Date | string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  format: VideoFormat;
  account?: {
    username: string;
  };
};

function VideoCard({ video }: { video: VideoCardData }) {
  const tier = getViralTier(video.views);
  const tiktokUrl = `https://www.tiktok.com/@${video.account?.username ?? "user"}/video/${video.tiktokVideoId}`;

  return (
    <a
      href={tiktokUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col overflow-hidden rounded-lg border border-border bg-card transition-colors hover:border-ring"
    >
      {/* Thumbnail */}
      <div className="relative aspect-[9/16] w-full bg-muted">
        {video.thumbnailUrl ? (
          <Image
            src={video.thumbnailUrl}
            alt={video.description || "Video thumbnail"}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground text-xs">
            No thumbnail
          </div>
        )}

        {/* View/Like overlay */}
        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent px-2 pb-2 pt-6">
          <div className="flex items-center gap-3 text-xs text-white">
            <span className="flex items-center gap-1">
              <Eye className="size-3" />
              {formatNumber(video.views)}
            </span>
            <span className="flex items-center gap-1">
              <Heart className="size-3" />
              {formatNumber(video.likes)}
            </span>
          </div>
        </div>

        {/* Date badge */}
        <div className="absolute top-2 left-2">
          <span className="rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
            {formatDate(video.postedAt)}
          </span>
        </div>
      </div>

      {/* Card body */}
      <div className="flex flex-1 flex-col gap-2 p-3">
        {/* Description */}
        <p className="line-clamp-2 text-xs text-foreground">
          {video.description || "No description"}
        </p>

        {/* Hashtags */}
        {video.hashtags.length > 0 && (
          <p className="line-clamp-1 text-[11px] text-muted-foreground">
            {video.hashtags.map((h) => `#${h}`).join(" ")}
          </p>
        )}

        {/* Badges */}
        <div className="mt-auto flex flex-wrap items-center gap-1.5">
          <FormatBadge format={video.format} />
          <ViralTierBadge tier={tier} />
        </div>

        {/* Comments/Shares */}
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <MessageCircle className="size-3" />
            {formatNumber(video.comments)}
          </span>
          <span className="flex items-center gap-1">
            <Share2 className="size-3" />
            {formatNumber(video.shares)}
          </span>
        </div>
      </div>
    </a>
  );
}

export function VideoGrid({ videos }: { videos: VideoCardData[] }) {
  if (videos.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-dashed border-border py-16 text-sm text-muted-foreground">
        No videos found
      </div>
    );
  }

  return (
    <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {videos.map((video) => (
        <VideoCard key={video.id} video={video} />
      ))}
    </div>
  );
}
