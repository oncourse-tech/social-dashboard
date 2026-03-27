import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { CACHE_TAGS, revalidateCacheTags } from "@/lib/cache";
import { getAccountsSummary } from "@/lib/queries";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const appId = searchParams.get("app");

  return NextResponse.json(await getAccountsSummary(appId ?? undefined));
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { username, appId } = body as { username: string; appId: string };

  if (!username || !appId) {
    return NextResponse.json(
      { error: "username and appId are required" },
      { status: 400 }
    );
  }

  const cleanUsername = username.replace(/^@/, "");

  try {
    const account = await db.trackedAccount.create({
      data: { username: cleanUsername, appId },
    });

    await revalidateCacheTags([
      CACHE_TAGS.accountSummaries,
      CACHE_TAGS.appSummaries,
    ]);

    return NextResponse.json(account, { status: 201 });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Account is already being tracked" },
        { status: 409 }
      );
    }

    throw error;
  }
}
