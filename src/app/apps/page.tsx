import { db } from "@/lib/db";
import { SummaryCards } from "@/components/summary-cards";
import { AddAppDialog } from "@/components/add-app-dialog";
import { AppsTable } from "./apps-table";
import type { AppWithStats } from "@/types";

export default async function AppsPage() {
  const settings = await db.settings.findFirst({ where: { id: "default" } });
  const threshold1 = settings?.viralThreshold1 ?? 5000;
  const threshold2 = settings?.viralThreshold2 ?? 50000;

  const apps = await db.app.findMany({
    include: {
      trackedAccounts: {
        include: {
          videos: {
            select: { views: true, postedAt: true },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  let grandTotalAccounts = 0;
  let grandTotalVideos = 0;
  let grandVideos7d = 0;
  let grandViral5k = 0;
  let grandViral50k = 0;

  const enrichedApps: AppWithStats[] = apps.map((app) => {
    let totalFollowers = 0;
    let totalLikes = 0;
    let totalVideos = 0;
    let videos7d = 0;
    let viral5k = 0;
    let viral50k = 0;

    for (const account of app.trackedAccounts) {
      totalFollowers += account.followers;
      totalLikes += account.totalLikes;
      totalVideos += account.videos.length;

      for (const video of account.videos) {
        if (video.postedAt >= sevenDaysAgo) videos7d++;
        if (video.views >= threshold2) viral50k++;
        else if (video.views >= threshold1) viral5k++;
      }
    }

    grandTotalAccounts += app.trackedAccounts.length;
    grandTotalVideos += totalVideos;
    grandVideos7d += videos7d;
    grandViral5k += viral5k;
    grandViral50k += viral50k;

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
    };
  });

  const summaryItems = [
    { label: "Total Apps", value: apps.length },
    { label: "Total Accounts", value: grandTotalAccounts },
    { label: "Total Videos", value: grandTotalVideos },
    { label: "Videos (7d)", value: grandVideos7d },
    { label: ">5K Views", value: grandViral5k, highlight: "#ef4444" },
    { label: ">50K Views", value: grandViral50k, highlight: "#ef4444" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Apps Overview</h1>
        <AddAppDialog />
      </div>
      <SummaryCards items={summaryItems} />
      <AppsTable data={enrichedApps} />
    </div>
  );
}
