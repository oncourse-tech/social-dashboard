import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { triggerTikTokScraper } from "@/lib/apify";

export async function POST() {
  let syncLog;

  try {
    const accounts = await db.trackedAccount.findMany({
      select: { username: true },
    });

    if (accounts.length === 0) {
      return NextResponse.json(
        { error: "No tracked accounts found" },
        { status: 400 }
      );
    }

    const usernames = accounts.map((a) => a.username);

    syncLog = await db.syncLog.create({
      data: { status: "RUNNING" },
    });

    const run = await triggerTikTokScraper(usernames);

    return NextResponse.json({
      syncLogId: syncLog.id,
      apifyRunId: run.id,
      accountCount: usernames.length,
    });
  } catch (error) {
    console.error("Sync trigger failed:", error);

    if (syncLog) {
      await db.syncLog.update({
        where: { id: syncLog.id },
        data: {
          status: "FAILED",
          completedAt: new Date(),
          errors: { message: error instanceof Error ? error.message : "Unknown error" },
        },
      });
    }

    return NextResponse.json(
      { error: "Failed to trigger sync" },
      { status: 500 }
    );
  }
}
