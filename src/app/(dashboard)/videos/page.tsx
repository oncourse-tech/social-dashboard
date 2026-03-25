export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { VideosClient } from "./videos-client";
import { type VideoFormat } from "@prisma/client";

const PAGE_SIZE = 50;
const VIDEO_FORMATS: VideoFormat[] = [
  "UGC_REACTION",
  "UGC_VOICEOVER",
  "CAROUSEL_SLIDESHOW",
  "OTHER",
];

type SearchParams = {
  page?: string | string[];
  search?: string | string[];
  app?: string | string[];
  format?: string | string[];
  minViews?: string | string[];
};

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parsePage(value: string | string[] | undefined) {
  const raw = Number.parseInt(firstValue(value) ?? "1", 10);
  return Number.isFinite(raw) && raw > 0 ? raw : 1;
}

function parseMinViews(value: string | string[] | undefined) {
  const raw = Number.parseInt(firstValue(value) ?? "", 10);
  return Number.isFinite(raw) && raw > 0 ? raw : null;
}

function parseFormat(value: string | string[] | undefined) {
  const raw = firstValue(value)?.trim() ?? "";
  return VIDEO_FORMATS.includes(raw as VideoFormat) ? raw : "all";
}

function buildWhere(params: SearchParams) {
  const search = firstValue(params.search)?.trim() ?? "";
  const app = firstValue(params.app)?.trim() ?? "";
  const format = firstValue(params.format)?.trim() ?? "";
  const minViews = parseMinViews(params.minViews);
  const tokens = search
    .split(/\s+/)
    .map((token) => token.replace(/^#/, "").trim())
    .filter(Boolean);

  const where: Record<string, unknown> = { relevant: true };

  if (app) {
    where.account = { is: { appId: app } };
  }

  if (VIDEO_FORMATS.includes(format as VideoFormat)) {
    where.format = format;
  }

  if (minViews !== null) {
    where.views = { gte: minViews };
  }

  if (search) {
    where.OR = [
      { description: { contains: search, mode: "insensitive" } },
      { hook: { contains: search, mode: "insensitive" } },
      { script: { contains: search, mode: "insensitive" } },
      { cta: { contains: search, mode: "insensitive" } },
      ...(tokens.length > 0
        ? [{ hashtags: { hasSome: tokens } }]
        : []),
    ];
  }

  return where;
}

export default async function VideosPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const requestedPage = parsePage(params.page);
  const where = buildWhere(params);
  const format = parseFormat(params.format);

  const [totalCount, apps] = await Promise.all([
    db.video.count({ where }),
    db.app.findMany({
      select: { id: true, name: true, color: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const currentPage = Math.min(requestedPage, totalPages);

  const videos = await db.video.findMany({
    where,
    include: {
      account: {
        include: { app: { select: { id: true, name: true, color: true } } },
      },
    },
    orderBy: { views: "desc" },
    skip: (currentPage - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });

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
      <h1 className="text-xl font-semibold">
        All Videos{" "}
        <span className="text-sm font-normal text-muted-foreground">
          ({totalCount.toLocaleString()})
        </span>
      </h1>
      <VideosClient
        videos={mapped}
        apps={apps}
        totalCount={totalCount}
        page={currentPage}
        pageSize={PAGE_SIZE}
        filters={{
          search: firstValue(params.search) ?? "",
          app: firstValue(params.app) ?? "all",
          format,
          minViews: firstValue(params.minViews) ?? "",
        }}
      />
    </div>
  );
}
