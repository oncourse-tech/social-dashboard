import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { db } from "../../lib/db";
import type { Prisma } from "@prisma/client";

export function registerVideoTools(server: McpServer) {
  server.registerTool(
    "search_videos",
    {
      title: "Search Videos",
      description:
        "Search and filter TikTok videos across all tracked accounts. Filter by views, format, account, app, hashtag, date range.",
      annotations: { readOnlyHint: true },
      inputSchema: z.object({
        minViews: z.number().optional().describe("Minimum view count"),
        maxViews: z.number().optional().describe("Maximum view count"),
        format: z
          .enum(["UGC_REACTION", "UGC_VOICEOVER", "CAROUSEL_SLIDESHOW", "OTHER"])
          .optional()
          .describe("Video format filter"),
        accountUsername: z
          .string()
          .optional()
          .describe("Filter to specific account"),
        appName: z
          .string()
          .optional()
          .describe("Filter to specific app/competitor group"),
        hashtag: z.string().optional().describe("Filter by hashtag"),
        dateFrom: z.string().optional().describe("Start date (ISO format)"),
        dateTo: z.string().optional().describe("End date (ISO format)"),
        relevant: z
          .boolean()
          .optional()
          .default(true)
          .describe("Filter by relevance flag"),
        sortBy: z
          .enum(["views", "likes", "comments", "shares", "postedAt"])
          .optional()
          .default("views")
          .describe("Sort field"),
        sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
        limit: z
          .number()
          .optional()
          .default(20)
          .describe("Max results (cap 100)"),
      }),
    },
    async (input): Promise<CallToolResult> => {
      const where: Prisma.VideoWhereInput = { relevant: input.relevant };

      if (input.minViews !== undefined || input.maxViews !== undefined) {
        where.views = {};
        if (input.minViews !== undefined) where.views.gte = input.minViews;
        if (input.maxViews !== undefined) where.views.lte = input.maxViews;
      }
      if (input.format) where.format = input.format;
      if (input.hashtag) where.hashtags = { has: input.hashtag };
      if (input.dateFrom || input.dateTo) {
        where.postedAt = {};
        if (input.dateFrom) where.postedAt.gte = new Date(input.dateFrom);
        if (input.dateTo) where.postedAt.lte = new Date(input.dateTo);
      }
      if (input.accountUsername) {
        where.account = { username: input.accountUsername };
      }
      if (input.appName) {
        where.account = {
          ...(where.account as Prisma.TrackedAccountWhereInput),
          app: { name: input.appName },
        };
      }

      const videos = await db.video.findMany({
        where,
        include: {
          account: {
            select: { username: true, app: { select: { name: true } } },
          },
        },
        orderBy: { [input.sortBy!]: input.sortOrder },
        take: Math.min(input.limit!, 100),
      });

      const result = videos.map((v) => ({
        tiktokVideoId: v.tiktokVideoId,
        description: v.description,
        views: v.views,
        likes: v.likes,
        comments: v.comments,
        shares: v.shares,
        postedAt: v.postedAt.toISOString(),
        format: v.format,
        hook: v.hook,
        cta: v.cta,
        accountUsername: v.account.username,
        appName: v.account.app.name,
      }));

      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }
  );

  server.registerTool(
    "get_video_details",
    {
      title: "Get Video Details",
      description:
        "Get full details for a specific TikTok video including engagement metrics, format analysis (hook/script/CTA), account info, and historical snapshots.",
      annotations: { readOnlyHint: true },
      inputSchema: z.object({
        tiktokVideoId: z.string().describe("The TikTok video ID"),
      }),
    },
    async ({ tiktokVideoId }): Promise<CallToolResult> => {
      const video = await db.video.findUnique({
        where: { tiktokVideoId },
        include: {
          account: {
            select: {
              username: true,
              displayName: true,
              app: { select: { name: true } },
            },
          },
          snapshots: { orderBy: { recordedAt: "desc" }, take: 10 },
        },
      });

      if (!video) {
        return {
          content: [
            { type: "text", text: `Video not found: ${tiktokVideoId}` },
          ],
          isError: true,
        };
      }

      return {
        content: [{ type: "text", text: JSON.stringify(video, null, 2) }],
      };
    }
  );

  server.registerTool(
    "get_viral_hooks",
    {
      title: "Get Viral Hooks",
      description:
        "Extract the top-performing hooks, scripts, and CTAs from viral videos. Use this to find what content strategies are working best.",
      annotations: { readOnlyHint: true },
      inputSchema: z.object({
        minViews: z
          .number()
          .optional()
          .default(5000)
          .describe("Minimum view count to consider viral"),
        format: z
          .enum(["UGC_REACTION", "UGC_VOICEOVER", "CAROUSEL_SLIDESHOW", "OTHER"])
          .optional(),
        appName: z.string().optional().describe("Filter to specific app"),
        limit: z.number().optional().default(20),
      }),
    },
    async (input): Promise<CallToolResult> => {
      const where: Prisma.VideoWhereInput = {
        views: { gte: input.minViews },
        hook: { not: null },
        relevant: true,
      };
      if (input.format) where.format = input.format;
      if (input.appName) where.account = { app: { name: input.appName } };

      const videos = await db.video.findMany({
        where,
        select: {
          tiktokVideoId: true,
          description: true,
          views: true,
          format: true,
          hook: true,
          script: true,
          cta: true,
          account: { select: { username: true } },
        },
        orderBy: { views: "desc" },
        take: Math.min(input.limit!, 100),
      });

      const result = videos.map((v) => ({
        hook: v.hook,
        script: v.script,
        cta: v.cta,
        views: v.views,
        format: v.format,
        description: v.description,
        accountUsername: v.account.username,
        tiktokVideoId: v.tiktokVideoId,
      }));

      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }
  );

  server.registerTool(
    "add_videos",
    {
      title: "Add Videos",
      description:
        "Push video data into the database for a tracked account. Upserts by tiktokVideoId — duplicates are skipped. The account must already be tracked.",
      annotations: { readOnlyHint: false },
      inputSchema: z.object({
        username: z.string().describe("Username of the tracked account"),
        videos: z
          .array(
            z.object({
              tiktokVideoId: z.string(),
              description: z.string(),
              views: z.number(),
              likes: z.number(),
              comments: z.number(),
              shares: z.number(),
              postedAt: z.string().describe("ISO date string"),
              duration: z.number().optional().default(0),
              hashtags: z.array(z.string()).optional().default([]),
              thumbnailUrl: z.string().optional(),
              videoUrl: z.string().optional(),
              musicName: z.string().optional(),
              isCarousel: z.boolean().optional().default(false),
            })
          )
          .describe("Array of video objects to insert"),
      }),
    },
    async ({ username, videos }): Promise<CallToolResult> => {
      const account = await db.trackedAccount.findUnique({
        where: { username },
      });
      if (!account) {
        return {
          content: [
            {
              type: "text",
              text: `Account not found: @${username}. Add it first with add_account.`,
            },
          ],
          isError: true,
        };
      }

      let inserted = 0;
      let skipped = 0;

      for (const v of videos) {
        try {
          await db.video.upsert({
            where: { tiktokVideoId: v.tiktokVideoId },
            create: {
              tiktokVideoId: v.tiktokVideoId,
              description: v.description,
              views: v.views,
              likes: v.likes,
              comments: v.comments,
              shares: v.shares,
              postedAt: new Date(v.postedAt),
              duration: v.duration ?? 0,
              hashtags: v.hashtags ?? [],
              thumbnailUrl: v.thumbnailUrl ?? null,
              videoUrl: v.videoUrl ?? null,
              musicName: v.musicName ?? null,
              isCarousel: v.isCarousel ?? false,
              accountId: account.id,
            },
            update: {},
          });
          inserted++;
        } catch {
          skipped++;
        }
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ inserted, skipped, total: videos.length }),
          },
        ],
      };
    }
  );
}
