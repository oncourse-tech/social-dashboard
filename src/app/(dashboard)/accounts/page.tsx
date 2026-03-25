export const dynamic = 'force-dynamic';

import { db } from "@/lib/db";
import { SummaryCards } from "@/components/summary-cards";
import { AddAccountDialog } from "@/components/add-account-dialog";
import { AccountsTable } from "./accounts-table";
import type { AccountWithStats } from "@/types";

export default async function AccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ app?: string }>;
}) {
  const params = await searchParams;
  const appFilter = params.app;

  const [settings, accounts, apps] = await Promise.all([
    db.settings.findFirst({ where: { id: "default" } }),
    db.trackedAccount.findMany({
      where: appFilter ? { appId: appFilter } : undefined,
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        followers: true,
        totalLikes: true,
        totalVideos: true,
        lastPostedAt: true,
        lastSyncedAt: true,
        trackingSince: true,
        app: { select: { id: true, name: true, color: true } },
      },
      orderBy: { username: "asc" },
    }),
    db.app.findMany({
      select: { id: true, name: true, color: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const threshold1 = settings?.viralThreshold1 ?? 5000;
  const threshold2 = settings?.viralThreshold2 ?? 50000;

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const accountIds = accounts.map((account) => account.id);
  const [weeklyVideos, viral5kVideos, viral10kVideos, viral50kVideos, formatRows] =
    accountIds.length === 0
      ? [[], [], [], [], []]
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
              views: { gte: threshold1, lt: 10000 },
            },
            _count: { _all: true },
          }),
          db.video.groupBy({
            by: ["accountId"],
            where: {
              accountId: { in: accountIds },
              views: { gte: 10000, lt: threshold2 },
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

  const weeklyVideosByAccount = new Map(
    weeklyVideos.map((row) => [row.accountId, row._count._all])
  );
  const viral5kByAccount = new Map(
    viral5kVideos.map((row) => [row.accountId, row._count._all])
  );
  const viral10kByAccount = new Map(
    viral10kVideos.map((row) => [row.accountId, row._count._all])
  );
  const viral50kByAccount = new Map(
    viral50kVideos.map((row) => [row.accountId, row._count._all])
  );
  const formatCountsByAccount = new Map<string, Map<string, number>>();

  for (const row of formatRows) {
    const accountFormats =
      formatCountsByAccount.get(row.accountId) ?? new Map<string, number>();
    accountFormats.set(row.format, row._count._all);
    formatCountsByAccount.set(row.accountId, accountFormats);
  }

  const enrichedAccounts: (AccountWithStats & { dominantFormat: string | null })[] = accounts.map((account) => {
      const formatCounts = formatCountsByAccount.get(account.id);
      const topFormatEntry = formatCounts
        ? [...formatCounts.entries()].sort((a, b) => b[1] - a[1])[0]
        : undefined;
      const dominantFormat = topFormatEntry ? topFormatEntry[0] : null;

      return {
        id: account.id,
        username: account.username,
        displayName: account.displayName,
        avatarUrl: account.avatarUrl,
        followers: account.followers,
        totalLikes: account.totalLikes,
        totalVideos: account.totalVideos,
        lastPostedAt: account.lastPostedAt,
        lastSyncedAt: account.lastSyncedAt,
        trackingSince: account.trackingSince,
        app: account.app,
        videos7d: weeklyVideosByAccount.get(account.id) ?? 0,
        viral5k: viral5kByAccount.get(account.id) ?? 0,
        viral10k: viral10kByAccount.get(account.id) ?? 0,
        viral50k: viral50kByAccount.get(account.id) ?? 0,
        dominantFormat,
      };
    });

  const grandFollowers = enrichedAccounts.reduce(
    (total, account) => total + account.followers,
    0
  );
  const grandVideos = enrichedAccounts.reduce(
    (total, account) => total + account.totalVideos,
    0
  );

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
