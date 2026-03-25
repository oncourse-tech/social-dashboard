export const dynamic = 'force-dynamic';

import {
  LayoutGrid,
  Users,
  Film,
  CalendarClock,
  TrendingUp,
  Flame,
} from "lucide-react";
import { db } from "@/lib/db";
import { SummaryCards } from "@/components/summary-cards";
import { AddAppDialog } from "@/components/add-app-dialog";
import { AppsTable } from "./apps-table";
import type { AppWithStats } from "@/types";
import { FORMAT_LABELS } from "@/lib/constants";
import { type VideoFormat } from "@prisma/client";

export default async function AppsPage() {
  const [settings, apps] = await Promise.all([
    db.settings.findFirst({ where: { id: "default" } }),
    db.app.findMany({
      select: {
        id: true,
        name: true,
        color: true,
        url: true,
        trackedAccounts: {
          select: {
            id: true,
            followers: true,
            totalLikes: true,
            totalVideos: true,
          },
        },
      },
      orderBy: { name: "asc" },
    }),
  ]);

  const threshold1 = settings?.viralThreshold1 ?? 5000;
  const threshold2 = settings?.viralThreshold2 ?? 50000;

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const accountIdToAppId = new Map<string, string>();
  const accountIds: string[] = [];

  for (const app of apps) {
    for (const account of app.trackedAccounts) {
      accountIdToAppId.set(account.id, app.id);
      accountIds.push(account.id);
    }
  }

  const [videos7dRows, viral5kRows, viral50kRows, formatRows] =
    accountIds.length === 0
      ? [[], [], [], []]
      : await Promise.all([
          db.video.groupBy({
            by: ["accountId"],
            where: {
              accountId: { in: accountIds },
              postedAt: { gte: sevenDaysAgo },
            },
            _count: { _all: true },
          }),
          db.video.groupBy({
            by: ["accountId"],
            where: {
              accountId: { in: accountIds },
              views: { gte: threshold1, lt: threshold2 },
            },
            _count: { _all: true },
          }),
          db.video.groupBy({
            by: ["accountId"],
            where: {
              accountId: { in: accountIds },
              views: { gte: threshold2 },
            },
            _count: { _all: true },
          }),
          db.video.groupBy({
            by: ["accountId", "format"],
            where: { accountId: { in: accountIds } },
            _count: { _all: true },
          }),
        ]);

  const videos7dByAccount = new Map(
    videos7dRows.map((row) => [row.accountId, row._count._all])
  );
  const viral5kByAccount = new Map(
    viral5kRows.map((row) => [row.accountId, row._count._all])
  );
  const viral50kByAccount = new Map(
    viral50kRows.map((row) => [row.accountId, row._count._all])
  );
  const formatCountsByApp = new Map<string, Map<string, number>>();

  for (const row of formatRows) {
    const appId = accountIdToAppId.get(row.accountId);
    if (!appId) continue;
    const appFormats = formatCountsByApp.get(appId) ?? new Map<string, number>();
    appFormats.set(
      row.format,
      (appFormats.get(row.format) ?? 0) + row._count._all
    );
    formatCountsByApp.set(appId, appFormats);
  }

  const enrichedApps: (AppWithStats & { topFormat: string })[] = apps.map((app) => {
    let totalFollowers = 0;
    let totalLikes = 0;
    let totalVideos = 0;
    let videos7d = 0;
    let viral5k = 0;
    let viral50k = 0;
    const formatCounts = formatCountsByApp.get(app.id);

    for (const account of app.trackedAccounts) {
      totalFollowers += account.followers;
      totalLikes += account.totalLikes;
      totalVideos += account.totalVideos;
      videos7d += videos7dByAccount.get(account.id) ?? 0;
      viral5k += viral5kByAccount.get(account.id) ?? 0;
      viral50k += viral50kByAccount.get(account.id) ?? 0;
    }

    const topFormatEntry = formatCounts
      ? [...formatCounts.entries()].sort((a, b) => b[1] - a[1])[0]
      : undefined;
    const topFormat = topFormatEntry
      ? FORMAT_LABELS[topFormatEntry[0] as VideoFormat]
      : "N/A";

    return {
      id: app.id,
      name: app.name,
      color: app.color,
      url: app.url,
      accountCount: app.trackedAccounts.length,
      totalFollowers,
      totalLikes,
      totalVideos,
      videos7d,
      viral5k,
      viral50k,
      topFormat,
    };
  });

  const grandTotalAccounts = enrichedApps.reduce(
    (total, app) => total + app.accountCount,
    0
  );
  const grandTotalVideos = enrichedApps.reduce(
    (total, app) => total + app.totalVideos,
    0
  );
  const grandVideos7d = enrichedApps.reduce(
    (total, app) => total + app.videos7d,
    0
  );
  const grandViral5k = enrichedApps.reduce(
    (total, app) => total + app.viral5k,
    0
  );
  const grandViral50k = enrichedApps.reduce(
    (total, app) => total + app.viral50k,
    0
  );

  const summaryItems = [
    { label: "Total Apps", value: apps.length, icon: <LayoutGrid className="size-5" /> },
    { label: "Total Accounts", value: grandTotalAccounts, icon: <Users className="size-5" /> },
    { label: "Total Videos", value: grandTotalVideos, icon: <Film className="size-5" /> },
    { label: "Videos (7d)", value: grandVideos7d, icon: <CalendarClock className="size-5" /> },
    { label: ">5K Views", value: grandViral5k, highlight: "#ef4444", icon: <TrendingUp className="size-5" /> },
    { label: ">50K Views", value: grandViral50k, highlight: "#ef4444", icon: <Flame className="size-5" /> },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h1 className="text-xl font-semibold">Apps Overview</h1>
        <AddAppDialog />
      </div>
      <SummaryCards items={summaryItems} />
      <AppsTable data={enrichedApps} />
    </div>
  );
}
