import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { db } from "../../lib/db";

export function registerAppTools(server: McpServer) {
  server.registerTool(
    "manage_apps",
    {
      title: "Manage Apps",
      description:
        "List, create, or delete apps (competitor groups). Use action 'list' to see all apps with stats, 'create' to add a new app, or 'delete' to remove one.",
      annotations: { readOnlyHint: false, destructiveHint: true },
      inputSchema: z.object({
        action: z.enum(["list", "create", "delete"]).describe("Action to perform"),
        name: z
          .string()
          .optional()
          .describe("App name (required for create/delete)"),
        color: z
          .string()
          .optional()
          .describe("Hex color (required for create, e.g. '#3b82f6')"),
        url: z.string().optional().describe("Optional URL for the app"),
      }),
    },
    async (input): Promise<CallToolResult> => {
      if (input.action === "list") {
        const apps = await db.app.findMany({
          include: {
            _count: { select: { trackedAccounts: true } },
            trackedAccounts: {
              select: {
                followers: true,
                totalLikes: true,
                _count: { select: { videos: true } },
              },
            },
          },
          orderBy: { name: "asc" },
        });

        const result = apps.map((app) => ({
          id: app.id,
          name: app.name,
          color: app.color,
          url: app.url,
          accountCount: app._count.trackedAccounts,
          totalFollowers: app.trackedAccounts.reduce(
            (sum, a) => sum + a.followers,
            0
          ),
          totalLikes: app.trackedAccounts.reduce(
            (sum, a) => sum + a.totalLikes,
            0
          ),
          totalVideos: app.trackedAccounts.reduce(
            (sum, a) => sum + a._count.videos,
            0
          ),
        }));

        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      if (input.action === "create") {
        if (!input.name || !input.color) {
          return {
            content: [
              { type: "text", text: "name and color are required for create" },
            ],
            isError: true,
          };
        }
        const app = await db.app.create({
          data: { name: input.name, color: input.color, url: input.url ?? null },
        });
        return {
          content: [{ type: "text", text: JSON.stringify(app, null, 2) }],
        };
      }

      if (input.action === "delete") {
        if (!input.name) {
          return {
            content: [
              { type: "text", text: "name is required for delete" },
            ],
            isError: true,
          };
        }
        const app = await db.app.findUnique({ where: { name: input.name } });
        if (!app) {
          return {
            content: [
              { type: "text", text: `App not found: "${input.name}"` },
            ],
            isError: true,
          };
        }
        await db.app.delete({ where: { id: app.id } });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ deleted: true, name: input.name }),
            },
          ],
        };
      }

      return {
        content: [{ type: "text", text: "Invalid action" }],
        isError: true,
      };
    }
  );
}
