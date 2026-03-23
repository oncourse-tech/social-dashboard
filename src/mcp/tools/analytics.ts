import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { db } from "../../lib/db";
import type { Prisma } from "@prisma/client";

export function registerAnalyticsTools(server: McpServer) {
  server.registerTool(
    "get_analytics",
    {
      title: "Get Analytics",
      description:
        "Get aggregated performance analytics across apps, accounts, or video formats. Returns total videos, total views, average views, viral count, and the top video for each group.",
      annotations: { readOnlyHint: true },
      inputSchema: z.object({
        appName: z.string().optional().describe("Filter to specific app"),
        dateRange: z
          .enum(["7d", "30d", "90d", "all"])
          .optional()
          .default("30d")
          .describe("Time range for analytics"),
        groupBy: z
          .enum(["app", "account", "format"])
          .optional()
          .default("app")
          .describe("How to group the results"),
      }),
    },
    async (input): Promise<CallToolResult> => {
      const where: Prisma.VideoWhereInput = { relevant: true };

      if (input.dateRange !== "all") {
        const days =
          input.dateRange === "7d" ? 7 : input.dateRange === "90d" ? 90 : 30;
        const since = new Date();
        since.setDate(since.getDate() - days);
        where.postedAt = { gte: since };
      }

      if (input.appName) {
        where.account = { app: { name: input.appName } };
      }

      const settings = await db.settings.findFirst({
        where: { id: "default" },
      });
      const viralThreshold = settings?.viralThreshold1 ?? 5000;

      const videos = await db.video.findMany({
        where,
        select: {
          tiktokVideoId: true,
          description: true,
          views: true,
          format: true,
          account: {
            select: {
              username: true,
              app: { select: { name: true } },
            },
          },
        },
      });

      const groups = new Map<
        string,
        {
          totalViews: number;
          viralCount: number;
          count: number;
          topVideo: { tiktokVideoId: string; description: string; views: number } | null;
        }
      >();

      for (const video of videos) {
        let key: string;
        if (input.groupBy === "account") key = video.account.username;
        else if (input.groupBy === "format") key = video.format;
        else key = video.account.app.name;

        if (!groups.has(key)) {
          groups.set(key, {
            totalViews: 0,
            viralCount: 0,
            count: 0,
            topVideo: null,
          });
        }
        const g = groups.get(key)!;
        g.count++;
        g.totalViews += video.views;
        if (video.views >= viralThreshold) g.viralCount++;
        if (!g.topVideo || video.views > g.topVideo.views) {
          g.topVideo = {
            tiktokVideoId: video.tiktokVideoId,
            description: video.description.slice(0, 100),
            views: video.views,
          };
        }
      }

      const result = Array.from(groups.entries())
        .map(([group, data]) => ({
          group,
          totalVideos: data.count,
          totalViews: data.totalViews,
          avgViews: data.count > 0 ? Math.round(data.totalViews / data.count) : 0,
          viralCount: data.viralCount,
          topVideo: data.topVideo,
        }))
        .sort((a, b) => b.totalViews - a.totalViews);

      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }
  );
}
