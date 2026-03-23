import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { getApifyClient, getDatasetItems } from "../../lib/apify";

export function registerResearchTools(server: McpServer) {
  server.registerTool(
    "research_profile",
    {
      title: "Research Profile",
      description:
        "Live lookup of any TikTok profile via Apify. Returns follower count, total likes, bio, and avatar. Note: this calls an external API and may take 10-30 seconds. Consumes Apify credits.",
      annotations: { readOnlyHint: true },
      inputSchema: z.object({
        username: z
          .string()
          .describe("TikTok username to research (with or without @)"),
      }),
    },
    async ({ username }): Promise<CallToolResult> => {
      const cleanUsername = username.replace(/^@/, "");

      try {
        const client = getApifyClient();
        const actorId =
          process.env.APIFY_ACTOR_ID || "clockworks/tiktok-profile-scraper";

        const run = await client.actor(actorId).call({
          profiles: [cleanUsername],
          resultsPerPage: 100,
        });

        const items = await getDatasetItems(run.defaultDatasetId);

        if (!items.length) {
          return {
            content: [
              { type: "text", text: `Profile not found: @${cleanUsername}` },
            ],
            isError: true,
          };
        }

        const firstItem = items[0] as Record<string, unknown>;
        const authorMeta = (firstItem.authorMeta ?? {}) as Record<
          string,
          unknown
        >;

        const profile = {
          username: (authorMeta.name ?? cleanUsername) as string,
          displayName: (authorMeta.nickName ?? null) as string | null,
          followers: (authorMeta.fans ?? 0) as number,
          totalLikes: (authorMeta.heart ?? 0) as number,
          bio: (authorMeta.signature ?? null) as string | null,
          avatarUrl: (authorMeta.avatar ?? null) as string | null,
          totalVideos: (authorMeta.video ?? items.length) as number,
        };

        return {
          content: [{ type: "text", text: JSON.stringify(profile, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Research failed: ${error instanceof Error ? error.message : "Unknown error"}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
