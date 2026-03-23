import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { db } from "../../lib/db";
import type { Prisma } from "@prisma/client";

export function registerAccountTools(server: McpServer) {
  server.registerTool(
    "search_accounts",
    {
      title: "Search Accounts",
      description:
        "Search tracked TikTok accounts with optional filters for app, follower count, and sorting.",
      annotations: { readOnlyHint: true },
      inputSchema: z.object({
        appName: z
          .string()
          .optional()
          .describe("Filter to specific app/competitor group"),
        minFollowers: z.number().optional(),
        maxFollowers: z.number().optional(),
        sortBy: z
          .enum(["followers", "totalLikes", "totalVideos", "lastPostedAt"])
          .optional()
          .default("followers"),
        limit: z.number().optional().default(20),
      }),
    },
    async (input): Promise<CallToolResult> => {
      const where: Prisma.TrackedAccountWhereInput = {};

      if (input.appName) where.app = { name: input.appName };
      if (input.minFollowers !== undefined || input.maxFollowers !== undefined) {
        where.followers = {};
        if (input.minFollowers !== undefined)
          where.followers.gte = input.minFollowers;
        if (input.maxFollowers !== undefined)
          where.followers.lte = input.maxFollowers;
      }

      const accounts = await db.trackedAccount.findMany({
        where,
        include: {
          app: { select: { name: true } },
          _count: { select: { videos: true } },
        },
        orderBy: { [input.sortBy!]: "desc" },
        take: Math.min(input.limit!, 100),
      });

      const result = accounts.map((a) => ({
        username: a.username,
        displayName: a.displayName,
        followers: a.followers,
        totalLikes: a.totalLikes,
        totalVideos: a._count.videos,
        lastPostedAt: a.lastPostedAt?.toISOString() ?? null,
        appName: a.app.name,
      }));

      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }
  );

  server.registerTool(
    "get_account_details",
    {
      title: "Get Account Details",
      description:
        "Get full details for a tracked TikTok account including app info, follower count, viral video counts, and the 10 most recent videos.",
      annotations: { readOnlyHint: true },
      inputSchema: z.object({
        username: z.string().describe("TikTok username"),
      }),
    },
    async ({ username }): Promise<CallToolResult> => {
      const settings = await db.settings.findFirst({
        where: { id: "default" },
      });
      const t1 = settings?.viralThreshold1 ?? 5000;
      const t2 = settings?.viralThreshold2 ?? 50000;

      const account = await db.trackedAccount.findUnique({
        where: { username },
        include: {
          app: { select: { id: true, name: true, color: true } },
          videos: {
            orderBy: { postedAt: "desc" },
            take: 10,
            select: {
              tiktokVideoId: true,
              description: true,
              views: true,
              likes: true,
              comments: true,
              shares: true,
              postedAt: true,
              format: true,
              hook: true,
            },
          },
          _count: { select: { videos: true } },
        },
      });

      if (!account) {
        return {
          content: [{ type: "text", text: `Account not found: @${username}` }],
          isError: true,
        };
      }

      const [viral5k, viral50k] = await Promise.all([
        db.video.count({
          where: { accountId: account.id, views: { gte: t1, lt: t2 } },
        }),
        db.video.count({
          where: { accountId: account.id, views: { gte: t2 } },
        }),
      ]);

      const result = {
        username: account.username,
        displayName: account.displayName,
        bio: account.bio,
        avatarUrl: account.avatarUrl,
        followers: account.followers,
        totalLikes: account.totalLikes,
        totalVideos: account._count.videos,
        lastPostedAt: account.lastPostedAt?.toISOString() ?? null,
        lastSyncedAt: account.lastSyncedAt?.toISOString() ?? null,
        trackingSince: account.trackingSince.toISOString(),
        app: account.app,
        viralVideos5k: viral5k,
        viralVideos50k: viral50k,
        recentVideos: account.videos,
      };

      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }
  );

  server.registerTool(
    "add_account",
    {
      title: "Add Account",
      description:
        "Start tracking a new TikTok account. Requires the username and the app (competitor group) name. The app must already exist.",
      annotations: { readOnlyHint: false },
      inputSchema: z.object({
        username: z.string().describe("TikTok username (with or without @)"),
        appName: z
          .string()
          .describe("Name of the app/competitor group to add to"),
      }),
    },
    async ({ username, appName }): Promise<CallToolResult> => {
      const cleanUsername = username.replace(/^@/, "");
      const app = await db.app.findUnique({ where: { name: appName } });

      if (!app) {
        return {
          content: [
            {
              type: "text",
              text: `App not found: "${appName}". Create it first with manage_apps.`,
            },
          ],
          isError: true,
        };
      }

      const existing = await db.trackedAccount.findUnique({
        where: { username: cleanUsername },
      });
      if (existing) {
        return {
          content: [
            {
              type: "text",
              text: `Account @${cleanUsername} is already being tracked.`,
            },
          ],
          isError: true,
        };
      }

      const account = await db.trackedAccount.create({
        data: { username: cleanUsername, appId: app.id },
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              id: account.id,
              username: account.username,
              appName,
              trackingSince: account.trackingSince.toISOString(),
            }),
          },
        ],
      };
    }
  );

  server.registerTool(
    "remove_account",
    {
      title: "Remove Account",
      description:
        "Stop tracking a TikTok account and delete all its stored video data. This is destructive and cannot be undone.",
      annotations: { readOnlyHint: false, destructiveHint: true },
      inputSchema: z.object({
        username: z.string().describe("TikTok username to stop tracking"),
      }),
    },
    async ({ username }): Promise<CallToolResult> => {
      const cleanUsername = username.replace(/^@/, "");
      const account = await db.trackedAccount.findUnique({
        where: { username: cleanUsername },
        include: { _count: { select: { videos: true } } },
      });

      if (!account) {
        return {
          content: [
            { type: "text", text: `Account not found: @${cleanUsername}` },
          ],
          isError: true,
        };
      }

      const videoCount = account._count.videos;
      await db.trackedAccount.delete({ where: { id: account.id } });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ removed: true, videosDeleted: videoCount }),
          },
        ],
      };
    }
  );
}
