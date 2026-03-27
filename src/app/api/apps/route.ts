import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { CACHE_TAGS, revalidateCacheTags } from "@/lib/cache";
import { getAppOptions, getAppsSummary } from "@/lib/queries";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const view = searchParams.get("view");

  return NextResponse.json(
    view === "options" ? await getAppOptions() : await getAppsSummary()
  );
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, color, url } = body as {
    name: string;
    color: string;
    url?: string;
  };

  if (!name || !color) {
    return NextResponse.json(
      { error: "Name and color are required" },
      { status: 400 }
    );
  }

  const app = await db.app.create({
    data: { name, color, url: url || null },
  });

  await revalidateCacheTags([
    CACHE_TAGS.appOptions,
    CACHE_TAGS.appSummaries,
    CACHE_TAGS.accountSummaries,
  ]);

  return NextResponse.json(app, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  await db.app.delete({ where: { id } });

  await revalidateCacheTags([
    CACHE_TAGS.appOptions,
    CACHE_TAGS.appSummaries,
    CACHE_TAGS.accountSummaries,
    CACHE_TAGS.videos,
  ]);

  return NextResponse.json({ success: true });
}
