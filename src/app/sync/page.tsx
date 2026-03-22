export const dynamic = 'force-dynamic';

import { db } from "@/lib/db";
import { SyncClient } from "./sync-client";

export default async function SyncPage() {
  const logs = await db.syncLog.findMany({
    orderBy: { startedAt: "desc" },
    take: 50,
  });

  const lastCompleted = logs.find((l) => l.status === "COMPLETED");

  const serialized = logs.map((log) => ({
    id: log.id,
    status: log.status,
    startedAt: log.startedAt.toISOString(),
    completedAt: log.completedAt?.toISOString() ?? null,
    accountsSynced: log.accountsSynced,
    videosSynced: log.videosSynced,
    newVideos: log.newVideos,
    errors: log.errors,
  }));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Sync Status</h1>
      <SyncClient
        logs={serialized}
        lastSync={lastCompleted?.completedAt?.toISOString() ?? null}
      />
    </div>
  );
}
