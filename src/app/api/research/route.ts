import { NextRequest, NextResponse } from "next/server";
import { getApifyClient } from "@/lib/apify";

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
    const actorId = process.env.APIFY_ACTOR_ID;
    if (!actorId) {
      return NextResponse.json(
        { error: "APIFY_ACTOR_ID is not configured" },
        { status: 500 }
      );
    }

    const run = await client.actor(actorId).call({
      profiles: [cleanUsername],
    });

    const { items } = await client
      .dataset(run.defaultDatasetId)
      .listItems();

    if (!items.length) {
      return NextResponse.json(
        { error: "Profile not found" },
        { status: 404 }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const item = items[0] as Record<string, any>;

    const profile = {
      username: (item.uniqueId ?? item.authorMeta?.name ?? cleanUsername) as string,
      displayName: (item.authorMeta?.nickName ?? item.nickname ?? null) as string | null,
      followers: (item.authorMeta?.fans ?? item.fans ?? 0) as number,
      totalLikes: (item.authorMeta?.heart ?? item.heart ?? 0) as number,
      bio: (item.authorMeta?.signature ?? item.signature ?? null) as string | null,
      avatarUrl: (item.authorMeta?.avatar ?? item.avatarMedium ?? null) as string | null,
      totalVideos: (item.authorMeta?.video ?? item.video ?? 0) as number,
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
