export const dynamic = 'force-dynamic';

import { db } from "@/lib/db";
import { SummaryCards } from "@/components/summary-cards";
import { AddAccountDialog } from "@/components/add-account-dialog";
import { AccountsTable } from "./accounts-table";
import type { AccountWithStats } from "@/types";
import { FORMAT_LABELS } from "@/lib/constants";
import { type VideoFormat } from "@prisma/client";

export default async function AccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ app?: string }>;
}) {
  const params = await searchParams;
  const appFilter = params.app;

  const settings = await db.settings.findFirst({ where: { id: "default" } });
  const threshold1 = settings?.viralThreshold1 ?? 5000;
  const threshold2 = settings?.viralThreshold2 ?? 50000;

  const accounts = await db.trackedAccount.findMany({
    where: appFilter ? { appId: appFilter } : undefined,
    include: {
      app: { select: { id: true, name: true, color: true } },
      videos: { select: { views: true, postedAt: true, format: true } },
    },
    orderBy: { username: "asc" },
  });

  const apps = await db.app.findMany({
    select: { id: true, name: true, color: true },
    orderBy: { name: "asc" },
  });

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  let grandFollowers = 0;
  let grandVideos = 0;

  const enrichedAccounts: (AccountWithStats & { dominantFormat: string | null })[] =
    accounts.map((account) => {
      let videos7d = 0;
      let viral5k = 0;
      let viral10k = 0;
      let viral50k = 0;
      const formatCounts: Record<string, number> = {};

      for (const video of account.videos) {
        if (video.postedAt >= sevenDaysAgo) videos7d++;
        if (video.views >= threshold2) viral50k++;
        else if (video.views >= 10000) viral10k++;
        else if (video.views >= threshold1) viral5k++;

        formatCounts[video.format] = (formatCounts[video.format] || 0) + 1;
      }

      grandFollowers += account.followers;
      grandVideos += account.videos.length;

      const topFormatEntry = Object.entries(formatCounts).sort(
        (a, b) => b[1] - a[1]
      )[0];
      const dominantFormat = topFormatEntry ? topFormatEntry[0] : null;

      return {
        id: account.id,
        username: account.username,
        displayName: account.displayName,
        avatarUrl: account.avatarUrl,
        followers: account.followers,
        totalLikes: account.totalLikes,
        totalVideos: account.videos.length,
        lastPostedAt: account.lastPostedAt,
        lastSyncedAt: account.lastSyncedAt,
        trackingSince: account.trackingSince,
        app: account.app,
        videos7d,
        viral5k,
        viral10k,
        viral50k,
        dominantFormat,
      };
    });

  const filterApp = appFilter
    ? apps.find((a) => a.id === appFilter)
    : null;

  const summaryItems = [
    { label: "Accounts", value: enrichedAccounts.length },
    { label: "Total Followers", value: grandFollowers },
    { label: "Total Videos", value: grandVideos },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          {filterApp ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <a href="/apps" className="hover:text-foreground">
                Apps
              </a>
              <span>/</span>
              <span className="text-foreground font-medium">
                {filterApp.name} Accounts
              </span>
            </div>
          ) : (
            <h1 className="text-xl font-semibold">Tracked Accounts</h1>
          )}
        </div>
        <AddAccountDialog apps={apps} />
      </div>
      <SummaryCards items={summaryItems} />
      <AccountsTable
        data={enrichedAccounts}
        apps={apps}
        currentAppFilter={appFilter}
      />
    </div>
  );
}
