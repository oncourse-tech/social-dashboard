export const dynamic = "force-dynamic";

import { Prisma, type VideoFormat } from "@prisma/client";
import { BarChart3, CalendarClock, Flame, TrendingUp } from "lucide-react";
import { db } from "@/lib/db";
import { SummaryCards } from "@/components/summary-cards";
import { FORMAT_LABELS } from "@/lib/constants";
import { ViralClient } from "./viral-client";

const PAGE_SIZE = 24;
const DEFAULT_PAGE = 1;

type SortOption = "views" | "likes" | "engagement" | "recent";
type TierFilter = "all" | "5K+" | "10K+" | "50K+";
type DateRange = "all" | "7d" | "30d" | "90d";

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseSort(value: string | string[] | undefined): SortOption {
  const raw = firstParam(value);
  return raw === "likes" || raw === "engagement" || raw === "recent"
    ? raw
    : "views";
}

function parseTier(value: string | string[] | undefined): TierFilter {
  const raw = firstParam(value);
  return raw === "5K+" || raw === "10K+" || raw === "50K+" ? raw : "all";
}

function parseFormat(value: string | string[] | undefined): VideoFormat | undefined {
  const raw = firstParam(value);
  if (!raw) return undefined;
  return raw in FORMAT_LABELS ? (raw as VideoFormat) : undefined;
}

function parseDateRange(value: string | string[] | undefined): DateRange {
  const raw = firstParam(value);
  return raw === "7d" || raw === "30d" || raw === "90d" ? raw : "all";
}

function parsePage(value: string | string[] | undefined): number {
  const raw = Number.parseInt(firstParam(value) ?? "", 10);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_PAGE;
}

function buildWhere({
  threshold1,
  threshold2,
  appFilter,
  formatFilter,
  tierFilter,
  dateRange,
}: {
  threshold1: number;
  threshold2: number;
  appFilter?: string;
  formatFilter?: VideoFormat;
  tierFilter: TierFilter;
  dateRange: DateRange;
}): Prisma.VideoWhereInput {
  const where: Prisma.VideoWhereInput = {
    relevant: true,
    views: { gte: threshold1 },
  };

  if (appFilter) {
    where.account = { appId: appFilter };
  }

  if (formatFilter) {
    where.format = formatFilter;
  }

  if (tierFilter === "10K+") {
    where.views = { gte: 10000 };
  } else if (tierFilter === "50K+") {
    where.views = { gte: threshold2 };
  } else if (tierFilter === "5K+") {
    where.views = { gte: threshold1 };
  }

  if (dateRange !== "all") {
    const now = new Date();
    const days = dateRange === "7d" ? 7 : dateRange === "30d" ? 30 : 90;
    const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    where.postedAt = { gte: cutoff };
  }

  return where;
}

function buildEngagementOrderWhere(
  threshold1: number,
  threshold2: number,
  appFilter?: string,
  formatFilter?: VideoFormat,
  tierFilter: TierFilter = "all",
  dateRange: DateRange = "all"
) {
  const conditions: Prisma.Sql[] = [
    Prisma.sql`v."relevant" = true`,
    Prisma.sql`v."views" >= ${threshold1}`,
  ];

  if (appFilter) {
    conditions.push(Prisma.sql`a."id" = ${appFilter}`);
  }

  if (formatFilter) {
    conditions.push(Prisma.sql`v."format" = ${formatFilter}`);
  }

  if (tierFilter === "10K+") {
    conditions.push(Prisma.sql`v."views" >= 10000`);
  } else if (tierFilter === "50K+") {
    conditions.push(Prisma.sql`v."views" >= ${threshold2}`);
  } else if (tierFilter === "5K+") {
    conditions.push(Prisma.sql`v."views" >= ${threshold1}`);
  }

  if (dateRange !== "all") {
    const now = new Date();
    const days = dateRange === "7d" ? 7 : dateRange === "30d" ? 30 : 90;
    const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    conditions.push(Prisma.sql`v."postedAt" >= ${cutoff}`);
  }

  return conditions.length
    ? Prisma.sql`WHERE ${Prisma.join(conditions, Prisma.sql` AND `)}`
    : Prisma.sql``;
}

export default async function ViralPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;

  const settings = await db.settings.findFirst({ where: { id: "default" } });
  const threshold1 = settings?.viralThreshold1 ?? 5000;
  const threshold2 = settings?.viralThreshold2 ?? 50000;

  const appFilter = firstParam(params.app);
  const formatFilter = parseFormat(params.format);
  const tierFilter = parseTier(params.tier);
  const dateRange = parseDateRange(params.period);
  const sortBy = parseSort(params.sort);
  const requestedPage = parsePage(params.page);

  const where = buildWhere({
    threshold1,
    threshold2,
    appFilter,
    formatFilter,
    tierFilter,
    dateRange,
  });

  const [totalViral, summary, topFormatGroups, apps] = await Promise.all([
    db.video.count({ where }),
    db.video.aggregate({
      where,
      _sum: { views: true, likes: true, comments: true, shares: true },
    }),
    db.video.groupBy({
      by: ["format"],
      where,
      _count: { format: true },
      orderBy: { _count: { format: "desc" } },
      take: 1,
    }),
    db.app.findMany({
      select: { id: true, name: true, color: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const pageCount = Math.max(1, Math.ceil(totalViral / PAGE_SIZE));
  const currentPage = Math.min(requestedPage, pageCount);
  const pageOffset = (currentPage - 1) * PAGE_SIZE;
  const pageStart = totalViral === 0 ? 0 : pageOffset + 1;
  const pageEnd = Math.min(pageOffset + PAGE_SIZE, totalViral);

  const videos =
    sortBy === "engagement"
      ? await (async () => {
          const engagementWhere = buildEngagementOrderWhere(
            threshold1,
            threshold2,
            appFilter,
            formatFilter,
            tierFilter,
            dateRange
          );

          const rows = await db.$queryRaw<Array<{ id: string }>>(Prisma.sql`
            SELECT v."id"
            FROM "Video" v
            INNER JOIN "TrackedAccount" ta ON ta."id" = v."accountId"
            INNER JOIN "App" a ON a."id" = ta."appId"
            ${engagementWhere}
            ORDER BY
              ((v."likes" + v."comments" + v."shares")::float / NULLIF(v."views", 0)) DESC,
              v."views" DESC,
              v."postedAt" DESC
            LIMIT ${PAGE_SIZE}
            OFFSET ${pageOffset}
          `);

          const orderedIds = rows.map((row) => row.id);
          if (!orderedIds.length) return [];

          const pageVideos = await db.video.findMany({
            where: { id: { in: orderedIds } },
            include: {
              account: {
                include: {
                  app: { select: { id: true, name: true, color: true } },
                },
              },
            },
          });

          const byId = new Map(pageVideos.map((video) => [video.id, video]));
          return orderedIds.flatMap((id) => {
            const video = byId.get(id);
            return video ? [video] : [];
          });
        })()
      : await db.video.findMany({
          where,
          include: {
            account: {
              include: { app: { select: { id: true, name: true, color: true } } },
            },
          },
          orderBy:
            sortBy === "likes"
              ? { likes: "desc" }
              : sortBy === "recent"
                ? { postedAt: "desc" }
                : { views: "desc" },
          skip: pageOffset,
          take: PAGE_SIZE,
        });

  const engRateBase = summary._sum.views
    ? ((summary._sum.likes ?? 0) +
        (summary._sum.comments ?? 0) +
        (summary._sum.shares ?? 0)) /
      summary._sum.views
    : 0;
  const avgEngRate = Math.round(engRateBase * 1000) / 10;

  const topFormat = topFormatGroups[0];
  const topFormatLabel = topFormat
    ? FORMAT_LABELS[topFormat.format]
    : "N/A";

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const videosThisWeekStart =
    typeof where.postedAt === "object" && where.postedAt && "gte" in where.postedAt
      ? where.postedAt.gte instanceof Date && where.postedAt.gte > sevenDaysAgo
        ? where.postedAt.gte
        : sevenDaysAgo
      : sevenDaysAgo;
  const videosThisWeek = await db.video.count({
    where: {
      ...where,
      postedAt: { gte: videosThisWeekStart },
    },
  });

  const summaryItems = [
    {
      label: "Total Viral Videos",
      value: totalViral,
      icon: <Flame className="size-4" />,
    },
    {
      label: "Avg Engagement Rate",
      value: avgEngRate,
      icon: <TrendingUp className="size-4" />,
      suffix: "%",
    },
    {
      label: "Top Format",
      value: 0,
      icon: <BarChart3 className="size-4" />,
      textValue: topFormatLabel,
    },
    {
      label: "Videos This Week",
      value: videosThisWeek,
      icon: <CalendarClock className="size-4" />,
    },
  ];

  const mapped = videos.map((v) => ({
    id: v.id,
    tiktokVideoId: v.tiktokVideoId,
    description: v.description,
    hashtags: v.hashtags,
    thumbnailUrl: v.thumbnailUrl,
    postedAt: v.postedAt.toISOString(),
    views: v.views,
    likes: v.likes,
    comments: v.comments,
    shares: v.shares,
    format: v.format,
    hook: v.hook,
    script: v.script,
    cta: v.cta,
    account: { username: v.account.username },
    app: v.account.app,
  }));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Viral Videos</h1>
      <SummaryCards items={summaryItems} />
      <ViralClient
        videos={mapped}
        apps={apps}
        page={currentPage}
        pageCount={pageCount}
        totalCount={totalViral}
        pageStart={pageStart}
        pageEnd={pageEnd}
      />
    </div>
  );
}
