import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const settings = await db.settings.findFirst({ where: { id: "default" } });

  if (!settings) {
    // Return defaults
    return NextResponse.json({
      viralThreshold1: 5000,
      viralThreshold2: 50000,
      apifyApiKey: "",
      apifyActorId: "",
      geminiApiKey: "",
      syncCron: "0 6 * * *",
    });
  }

  return NextResponse.json({
    viralThreshold1: settings.viralThreshold1,
    viralThreshold2: settings.viralThreshold2,
    apifyApiKey: settings.apifyApiKey,
    apifyActorId: settings.apifyActorId,
    geminiApiKey: settings.geminiApiKey,
    syncCron: settings.syncCron,
  });
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

  return NextResponse.json({
    viralThreshold1: settings.viralThreshold1,
    viralThreshold2: settings.viralThreshold2,
    apifyApiKey: settings.apifyApiKey,
    apifyActorId: settings.apifyActorId,
    geminiApiKey: settings.geminiApiKey,
    syncCron: settings.syncCron,
  });
}
