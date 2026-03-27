import { unstable_cache } from "next/cache";
import { type VideoFormat } from "@prisma/client";
import { db } from "@/lib/db";
import { getApifyClient, getDatasetItems } from "@/lib/apify";
import { CACHE_TAGS } from "@/lib/cache";
import type { AccountWithStats, AppWithStats } from "@/types";

export type SettingsData = {
  viralThreshold1: number;
  viralThreshold2: number;
  apifyApiKey: string;
  apifyActorId: string;
  geminiApiKey: string;
  syncCron: string;
};

export type AppOption = {
  id: string;
  name: string;
  color: string;
};

export type ProfileResult = {
  username: string;
  displayName: string | null;
  followers: number;
  totalLikes: number;
  bio: string | null;
  avatarUrl: string | null;
  totalVideos: number;
};

const defaultSettings: SettingsData = {
  viralThreshold1: 5000,
  viralThreshold2: 50000,
  apifyApiKey: "",
  apifyActorId: "",
  geminiApiKey: "",
  syncCron: "0 6 * * *",
};

const getSettingsCached = unstable_cache(
  async (): Promise<SettingsData> => {
    const settings = await db.settings.findUnique({
      where: { id: "default" },
      select: {
        viralThreshold1: true,
        viralThreshold2: true,
        apifyApiKey: true,
        apifyActorId: true,
        geminiApiKey: true,
        syncCron: true,
      },
    });

    return settings ?? defaultSettings;
  },
  ["settings"],
  {
    tags: [CACHE_TAGS.settings],
    revalidate: 60 * 60,
  }
);

const getAppOptionsCached = unstable_cache(
  async (): Promise<AppOption[]> =>
    db.app.findMany({
      select: { id: true, name: true, color: true },
      orderBy: { name: "asc" },
    }),
  ["app-options"],
  {
    tags: [CACHE_TAGS.appOptions],
    revalidate: 60 * 60,
  }
);

const getAppsSummaryCached = unstable_cache(
  async (): Promise<AppWithStats[]> => {
    const settings = await getSettingsCached();
    const apps = await db.app.findMany({
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
    });

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

    const [videos7dRows, viral5kRows, viral50kRows] =
      accountIds.length === 0
        ? [[], [], []]
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
                views: {
                  gte: settings.viralThreshold1,
                  lt: settings.viralThreshold2,
                },
              },
              _count: { _all: true },
            }),
            db.video.groupBy({
              by: ["accountId"],
              where: {
                accountId: { in: accountIds },
                views: { gte: settings.viralThreshold2 },
              },
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

    return apps.map((app) => {
      let totalFollowers = 0;
      let totalLikes = 0;
      let totalVideos = 0;
      let videos7d = 0;
      let viral5k = 0;
      let viral50k = 0;

      for (const account of app.trackedAccounts) {
        totalFollowers += account.followers;
        totalLikes += account.totalLikes;
        totalVideos += account.totalVideos;
        videos7d += videos7dByAccount.get(account.id) ?? 0;
        viral5k += viral5kByAccount.get(account.id) ?? 0;
        viral50k += viral50kByAccount.get(account.id) ?? 0;
      }

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
  },
  ["app-summaries"],
  {
    tags: [CACHE_TAGS.settings, CACHE_TAGS.appSummaries, CACHE_TAGS.videos],
    revalidate: 60,
  }
);

const getAccountsSummaryCached = unstable_cache(
  async (appId?: string): Promise<AccountWithStats[]> => {
    const settings = await getSettingsCached();
    const accounts = await db.trackedAccount.findMany({
      where: appId ? { appId } : undefined,
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
    });

    const accountIds = accounts.map((account) => account.id);
    if (accountIds.length === 0) {
      return [];
    }

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [weeklyVideos, viral5kVideos, viral10kVideos, viral50kVideos] =
      await Promise.all([
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
            views: { gte: settings.viralThreshold1, lt: 10000 },
          },
          _count: { _all: true },
        }),
        db.video.groupBy({
          by: ["accountId"],
          where: {
            accountId: { in: accountIds },
            views: { gte: 10000, lt: settings.viralThreshold2 },
          },
          _count: { _all: true },
        }),
        db.video.groupBy({
          by: ["accountId"],
          where: {
            accountId: { in: accountIds },
            views: { gte: settings.viralThreshold2 },
          },
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

    return accounts.map((account) => ({
      ...account,
      videos7d: weeklyVideosByAccount.get(account.id) ?? 0,
      viral5k: viral5kByAccount.get(account.id) ?? 0,
      viral10k: viral10kByAccount.get(account.id) ?? 0,
      viral50k: viral50kByAccount.get(account.id) ?? 0,
    }));
  },
  ["account-summaries"],
  {
    tags: [CACHE_TAGS.settings, CACHE_TAGS.accountSummaries, CACHE_TAGS.videos],
    revalidate: 60,
  }
);

const getResearchProfileCached = unstable_cache(
  async (username: string): Promise<ProfileResult | null> => {
    const cleanUsername = username.replace(/^@/, "");
    const client = getApifyClient();
    const actorId =
      process.env.APIFY_ACTOR_ID || "clockworks/tiktok-profile-scraper";

    const run = await client.actor(actorId).call({
      profiles: [cleanUsername],
      resultsPerPage: 100,
    });

    const items = await getDatasetItems(run.defaultDatasetId);
    if (!items.length) {
      return null;
    }

    const firstItem = items[0] as Record<string, unknown>;
    const authorMeta =
      firstItem.authorMeta && typeof firstItem.authorMeta === "object"
        ? (firstItem.authorMeta as Record<string, unknown>)
        : {};

    return {
      username: String(authorMeta.name ?? cleanUsername),
      displayName:
        authorMeta.nickName == null ? null : String(authorMeta.nickName),
      followers: Number(authorMeta.fans ?? 0),
      totalLikes: Number(authorMeta.heart ?? 0),
      bio: authorMeta.signature == null ? null : String(authorMeta.signature),
      avatarUrl: authorMeta.avatar == null ? null : String(authorMeta.avatar),
      totalVideos: Number(authorMeta.video ?? items.length),
    };
  },
  ["research-profile"],
  {
    tags: [CACHE_TAGS.researchProfiles],
    revalidate: 60 * 60,
  }
);

export async function getSettings() {
  return getSettingsCached();
}

export async function getAppOptions() {
  return getAppOptionsCached();
}

export async function getAppsSummary() {
  return getAppsSummaryCached();
}

export async function getAccountsSummary(appId?: string) {
  return getAccountsSummaryCached(appId);
}

export async function getResearchProfile(username: string) {
  return getResearchProfileCached(username);
}

export function isValidVideoFormat(value: string): value is VideoFormat {
  return [
    "UGC_REACTION",
    "UGC_VOICEOVER",
    "CAROUSEL_SLIDESHOW",
    "OTHER",
  ].includes(value);
}
