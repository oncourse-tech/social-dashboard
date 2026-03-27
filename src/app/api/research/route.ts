import { NextRequest, NextResponse } from "next/server";
import { getApifyClient, getDatasetItems } from "@/lib/apify";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username } = body as { username: string };

    if (!username) {
      return NextResponse.json(
        { error: "username is required" },
        { status: 400 }
      );
    }

    const cleanUsername = username.replace(/^@/, "");
    const client = getApifyClient();
    // Use the profile scraper actor (or custom actor ID from env)
    const actorId =
      process.env.APIFY_ACTOR_ID || "clockworks/tiktok-profile-scraper";

    const run = await client.actor(actorId).call({
      profiles: [cleanUsername],
      resultsPerPage: 100,
    });

    const items = await getDatasetItems(run.defaultDatasetId);

    if (!items.length) {
      return NextResponse.json(
        { error: "Profile not found" },
        { status: 404 }
      );
    }

    // The profile scraper returns a flat array of videos.
    // Extract profile info from the first item's authorMeta.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const firstItem = items[0] as Record<string, any>;
    const authorMeta = firstItem.authorMeta ?? {};

    const profile = {
      username: (authorMeta.name ?? cleanUsername) as string,
      displayName: (authorMeta.nickName ?? null) as string | null,
      followers: (authorMeta.fans ?? 0) as number,
      totalLikes: (authorMeta.heart ?? 0) as number,
      bio: (authorMeta.signature ?? null) as string | null,
      avatarUrl: (authorMeta.avatar ?? null) as string | null,
      totalVideos: (authorMeta.video ?? items.length) as number,
    };

    return NextResponse.json(profile);
  } catch (error) {
    console.error("Research lookup failed:", error);
    return NextResponse.json(
      { error: "Failed to look up profile" },
      { status: 500 }
    );
  }
}
