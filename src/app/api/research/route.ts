import { NextRequest, NextResponse } from "next/server";
import { getDatasetItems } from "@/lib/apify";

const APIFY_BASE = "https://api.apify.com/v2";

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
    const token = process.env.APIFY_API_KEY;
    const actorId = process.env.APIFY_ACTOR_ID;

    if (!token || !actorId) {
      return NextResponse.json(
        { error: "Apify is not configured" },
        { status: 500 }
      );
    }

    // Trigger actor run for single profile
    const runRes = await fetch(
      `${APIFY_BASE}/acts/${actorId}/runs?token=${token}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profiles: [cleanUsername] }),
      }
    );

    if (!runRes.ok) {
      return NextResponse.json(
        { error: "Failed to start Apify run" },
        { status: 500 }
      );
    }

    const run = await runRes.json();
    const datasetId = run.data.defaultDatasetId;

    // Wait for run to complete (poll every 2s, max 60s)
    const startTime = Date.now();
    while (Date.now() - startTime < 60000) {
      const statusRes = await fetch(
        `${APIFY_BASE}/actor-runs/${run.data.id}?token=${token}`
      );
      const statusData = await statusRes.json();
      if (statusData.data.status === "SUCCEEDED") break;
      if (statusData.data.status === "FAILED") {
        return NextResponse.json(
          { error: "Profile lookup failed" },
          { status: 500 }
        );
      }
      await new Promise((r) => setTimeout(r, 2000));
    }

    const items = await getDatasetItems(datasetId);

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
