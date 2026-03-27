import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { CACHE_TAGS, revalidateCacheTags } from "@/lib/cache";
import { getSettings } from "@/lib/queries";

export async function GET() {
  return NextResponse.json(await getSettings());
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const {
    viralThreshold1,
    viralThreshold2,
    apifyApiKey,
    apifyActorId,
    geminiApiKey,
    syncCron,
  } = body as {
    viralThreshold1: number;
    viralThreshold2: number;
    apifyApiKey: string;
    apifyActorId: string;
    geminiApiKey: string;
    syncCron: string;
  };

  const settings = await db.settings.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      viralThreshold1,
      viralThreshold2,
      apifyApiKey,
      apifyActorId,
      geminiApiKey,
      syncCron,
    },
    update: {
      viralThreshold1,
      viralThreshold2,
      apifyApiKey,
      apifyActorId,
      geminiApiKey,
      syncCron,
    },
  });

  await revalidateCacheTags([
    CACHE_TAGS.settings,
    CACHE_TAGS.appSummaries,
    CACHE_TAGS.accountSummaries,
  ]);

  return NextResponse.json({
    viralThreshold1: settings.viralThreshold1,
    viralThreshold2: settings.viralThreshold2,
    apifyApiKey: settings.apifyApiKey,
    apifyActorId: settings.apifyActorId,
    geminiApiKey: settings.geminiApiKey,
    syncCron: settings.syncCron,
  });
}
