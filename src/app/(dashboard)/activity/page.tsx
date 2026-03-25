export const dynamic = 'force-dynamic';

import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { ActivityClient } from "./activity-client";

export default async function ActivityPage() {
  const [apps, heatmapRows] = await Promise.all([
    db.app.findMany({
      select: { id: true, name: true, color: true },
      orderBy: { name: "asc" },
    }),
    db.$queryRaw<
      {
        dayIdx: number;
        hour: number;
        count: number;
      }[]
    >(Prisma.sql`
      SELECT
        day_idx AS "dayIdx",
        hour,
        COUNT(*)::int AS count
      FROM (
        SELECT
          CASE
            WHEN EXTRACT(DOW FROM "postedAt" AT TIME ZONE 'UTC')::int = 0 THEN 6
            ELSE EXTRACT(DOW FROM "postedAt" AT TIME ZONE 'UTC')::int - 1
          END AS day_idx,
          EXTRACT(HOUR FROM "postedAt" AT TIME ZONE 'UTC')::int AS hour
        FROM "Video"
      ) AS video_hours
      GROUP BY day_idx, hour
    `),
  ]);

  // Build heatmap: key = "dayIdx-hour", value = count
  const heatmap: Record<string, number> = {};

  for (const row of heatmapRows) {
    heatmap[`${row.dayIdx}-${row.hour}`] = row.count;
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Posting Activity</h1>
      <ActivityClient heatmap={heatmap} apps={apps} />
    </div>
  );
}
