# MCP Server Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an MCP server that exposes the social-dashboard's TikTok competitor intelligence data to AI agents via 11 tools.

**Architecture:** Single MCP server instance (`src/mcp/server.ts`) with tools split across domain-specific files. Two transport entry points: stdio for local Claude Code/Desktop use, Streamable HTTP for remote agents. Direct Prisma DB access, shared Apify client for research.

**Tech Stack:** `@modelcontextprotocol/sdk` (McpServer, StdioServerTransport, NodeStreamableHTTPServerTransport), Zod v4 (via `zod/v4`), existing Prisma client, existing Apify client.

**Spec:** `docs/superpowers/specs/2026-03-24-mcp-server-design.md`

---

## File Structure

```
src/mcp/
├── server.ts              # Creates McpServer, imports and registers all tools
├── tools/
│   ├── videos.ts          # search_videos, get_video_details, get_viral_hooks, add_videos
│   ├── accounts.ts        # search_accounts, get_account_details, add_account, remove_account
│   ├── research.ts        # research_profile
│   ├── apps.ts            # manage_apps
│   └── analytics.ts       # get_analytics
└── transports/
    ├── stdio.ts           # stdio entry point
    └── http.ts            # HTTP entry point with bearer token auth
```

---

### Task 1: Install dependency and add scripts

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install the MCP SDK**

```bash
cd /Users/shubh/workspace/oncourse/social-dashboard && pnpm add @modelcontextprotocol/sdk zod
```

- [ ] **Step 1b: Verify import paths**

After install, check what the SDK actually exports:

```bash
ls node_modules/@modelcontextprotocol/sdk/dist/ 2>/dev/null || ls node_modules/@modelcontextprotocol/
```

Then verify the correct import path for `McpServer` and `StdioServerTransport`:

```bash
grep -r "export.*McpServer" node_modules/@modelcontextprotocol/sdk/dist/ 2>/dev/null | head -3
```

The plan assumes `@modelcontextprotocol/sdk/server` as the import path. If the SDK uses a different structure, update all imports accordingly. Common alternatives: `@modelcontextprotocol/server` (if it's a separate package) or `@modelcontextprotocol/sdk` (flat export).

- [ ] **Step 2: Add mcp scripts to package.json**

Add these scripts to `package.json`:
```json
"mcp": "tsx src/mcp/transports/stdio.ts",
"mcp:http": "tsx src/mcp/transports/http.ts"
```

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "feat(mcp): install @modelcontextprotocol/sdk and add mcp scripts"
```

---

### Task 2: Create MCP server core

**Files:**
- Create: `src/mcp/server.ts`

- [ ] **Step 1: Create the server file**

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server";

export function createServer() {
  const server = new McpServer(
    {
      name: "social-dashboard",
      version: "1.0.0",
    },
    {
      capabilities: { logging: {} },
    }
  );

  return server;
}
```

This is intentionally minimal — tools will be registered in Task 4+. We'll import and call registration functions here after they're built.

- [ ] **Step 2: Commit**

```bash
git add src/mcp/server.ts
git commit -m "feat(mcp): create MCP server core"
```

---

### Task 3: Create stdio and HTTP transports

**Files:**
- Create: `src/mcp/transports/stdio.ts`
- Create: `src/mcp/transports/http.ts`

- [ ] **Step 1: Create the stdio transport entry point**

```typescript
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server";
import { createServer } from "../server";

async function main() {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Social Dashboard MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
```

- [ ] **Step 2: Create the HTTP transport entry point**

```typescript
import { createServer as createHttpServer } from "node:http";
import { createServer } from "../server";

const API_KEY = process.env.MCP_API_KEY;
const PORT = parseInt(process.env.MCP_PORT || "3100", 10);

async function main() {
  const server = createServer();

  // Import the HTTP transport dynamically — the exact export path varies by SDK version.
  // Try these in order:
  //   1. "@modelcontextprotocol/sdk/server" (NodeStreamableHTTPServerTransport)
  //   2. "@modelcontextprotocol/sdk" (flat export)
  // After install, verify with: grep -r "NodeStreamableHTTP\|StreamableHTTP" node_modules/@modelcontextprotocol/
  const { NodeStreamableHTTPServerTransport } = await import("@modelcontextprotocol/sdk/server");

  const transport = new NodeStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
  await server.connect(transport);

  createHttpServer(async (req, res) => {
    // Bearer token auth if MCP_API_KEY is set
    if (API_KEY) {
      const auth = req.headers.authorization;
      if (!auth || auth !== `Bearer ${API_KEY}`) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Unauthorized" }));
        return;
      }
    }

    await transport.handleRequest(req, res);
  }).listen(PORT);

  console.error(`Social Dashboard MCP Server running on http://localhost:${PORT}`);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
```

Note: The HTTP transport import path may differ. After `pnpm add`, verify the correct import:
```bash
grep -r "NodeStreamableHTTP\|StreamableHTTP" node_modules/@modelcontextprotocol/sdk/dist/ 2>/dev/null | head -5
```
If the class is not found, check if the SDK requires a separate middleware package (`@modelcontextprotocol/node`).

- [ ] **Step 3: Test stdio transport starts**

```bash
cd /Users/shubh/workspace/oncourse/social-dashboard && echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-11-25","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}' | pnpm mcp 2>/dev/null
```

Expected: JSON-RPC response with server info and capabilities. If it errors on missing imports, fix the import path.

- [ ] **Step 4: Commit**

```bash
git add src/mcp/transports/
git commit -m "feat(mcp): add stdio and HTTP transport entry points"
```

---

### Task 4: Implement video tools (search_videos, get_video_details, get_viral_hooks, add_videos)

**Files:**
- Create: `src/mcp/tools/videos.ts`
- Modify: `src/mcp/server.ts` (import and call registration)

- [ ] **Step 1: Create videos.ts with all four tools**

```typescript
import type { McpServer } from "@modelcontextprotocol/sdk/server";
import type { CallToolResult } from "@modelcontextprotocol/sdk/server";
import * as z from "zod/v4";
import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";

// Note: If `@/` path alias fails under tsx, replace with relative paths:
// import { db } from "../../lib/db";
// import type { Prisma } from "@prisma/client";

export function registerVideoTools(server: McpServer) {
  // --- search_videos ---
  server.registerTool(
    "search_videos",
    {
      title: "Search Videos",
      description:
        "Search and filter TikTok videos across all tracked accounts. Filter by views, format, account, app, hashtag, date range. Returns matching videos sorted by the chosen field.",
      annotations: { readOnlyHint: true },
      inputSchema: z.object({
        minViews: z.number().optional().describe("Minimum view count"),
        maxViews: z.number().optional().describe("Maximum view count"),
        format: z
          .enum(["UGC_REACTION", "UGC_VOICEOVER", "CAROUSEL_SLIDESHOW", "OTHER"])
          .optional()
          .describe("Video format filter"),
        accountUsername: z.string().optional().describe("Filter to specific account"),
        appName: z.string().optional().describe("Filter to specific app/competitor group"),
        hashtag: z.string().optional().describe("Filter by hashtag"),
        dateFrom: z.string().optional().describe("Start date (ISO format)"),
        dateTo: z.string().optional().describe("End date (ISO format)"),
        relevant: z.boolean().optional().default(true).describe("Filter by relevance flag"),
        sortBy: z
          .enum(["views", "likes", "comments", "shares", "postedAt"])
          .optional()
          .default("views")
          .describe("Sort field"),
        sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
        limit: z.number().optional().default(20).describe("Max results (cap 100)"),
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
          account: { select: { username: true, app: { select: { name: true } } } },
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

      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  // --- get_video_details ---
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
          account: { select: { username: true, displayName: true, app: { select: { name: true } } } },
          snapshots: { orderBy: { recordedAt: "desc" }, take: 10 },
        },
      });

      if (!video) {
        return { content: [{ type: "text", text: `Video not found: ${tiktokVideoId}` }], isError: true };
      }

      return { content: [{ type: "text", text: JSON.stringify(video, null, 2) }] };
    }
  );

  // --- get_viral_hooks ---
  server.registerTool(
    "get_viral_hooks",
    {
      title: "Get Viral Hooks",
      description:
        "Extract the top-performing hooks, scripts, and CTAs from viral videos. Use this to find what content strategies are working best.",
      annotations: { readOnlyHint: true },
      inputSchema: z.object({
        minViews: z.number().optional().default(5000).describe("Minimum view count to consider viral"),
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

      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  // --- add_videos ---
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
      const account = await db.trackedAccount.findUnique({ where: { username } });
      if (!account) {
        return {
          content: [{ type: "text", text: `Account not found: @${username}. Add it first with add_account.` }],
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
            update: {}, // skip if exists
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
```

- [ ] **Step 2: Wire up in server.ts**

Update `src/mcp/server.ts` to import and call the registration function:

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server";
import { registerVideoTools } from "./tools/videos";

export function createServer() {
  const server = new McpServer(
    {
      name: "social-dashboard",
      version: "1.0.0",
    },
    {
      capabilities: { logging: {} },
    }
  );

  registerVideoTools(server);

  return server;
}
```

- [ ] **Step 3: Test that the server starts and lists tools**

```bash
cd /Users/shubh/workspace/oncourse/social-dashboard && echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-11-25","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}
{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' | pnpm mcp 2>/dev/null
```

Expected: Response listing `search_videos`, `get_video_details`, `get_viral_hooks`, `add_videos`.

- [ ] **Step 4: Commit**

```bash
git add src/mcp/
git commit -m "feat(mcp): implement video tools (search, details, viral hooks, add)"
```

---

### Task 5: Implement account tools (search_accounts, get_account_details, add_account, remove_account)

**Files:**
- Create: `src/mcp/tools/accounts.ts`
- Modify: `src/mcp/server.ts` (add import)

- [ ] **Step 1: Create accounts.ts**

```typescript
import type { McpServer } from "@modelcontextprotocol/sdk/server";
import type { CallToolResult } from "@modelcontextprotocol/sdk/server";
import * as z from "zod/v4";
import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export function registerAccountTools(server: McpServer) {
  // --- search_accounts ---
  server.registerTool(
    "search_accounts",
    {
      title: "Search Accounts",
      description:
        "Search tracked TikTok accounts with optional filters for app, follower count, and sorting.",
      annotations: { readOnlyHint: true },
      inputSchema: z.object({
        appName: z.string().optional().describe("Filter to specific app/competitor group"),
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
        if (input.minFollowers !== undefined) where.followers.gte = input.minFollowers;
        if (input.maxFollowers !== undefined) where.followers.lte = input.maxFollowers;
      }

      const accounts = await db.trackedAccount.findMany({
        where,
        include: { app: { select: { name: true } }, _count: { select: { videos: true } } },
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

      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  // --- get_account_details ---
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
      const settings = await db.settings.findFirst({ where: { id: "default" } });
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
        return { content: [{ type: "text", text: `Account not found: @${username}` }], isError: true };
      }

      // Count viral videos
      const [viral5k, viral50k] = await Promise.all([
        db.video.count({ where: { accountId: account.id, views: { gte: t1, lt: t2 } } }),
        db.video.count({ where: { accountId: account.id, views: { gte: t2 } } }),
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

      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  // --- add_account ---
  server.registerTool(
    "add_account",
    {
      title: "Add Account",
      description:
        "Start tracking a new TikTok account. Requires the username and the app (competitor group) name. The app must already exist.",
      annotations: { readOnlyHint: false },
      inputSchema: z.object({
        username: z.string().describe("TikTok username (with or without @)"),
        appName: z.string().describe("Name of the app/competitor group to add to"),
      }),
    },
    async ({ username, appName }): Promise<CallToolResult> => {
      const cleanUsername = username.replace(/^@/, "");
      const app = await db.app.findUnique({ where: { name: appName } });

      if (!app) {
        return {
          content: [{ type: "text", text: `App not found: "${appName}". Create it first with manage_apps.` }],
          isError: true,
        };
      }

      const existing = await db.trackedAccount.findUnique({ where: { username: cleanUsername } });
      if (existing) {
        return {
          content: [{ type: "text", text: `Account @${cleanUsername} is already being tracked.` }],
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

  // --- remove_account ---
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
        return { content: [{ type: "text", text: `Account not found: @${cleanUsername}` }], isError: true };
      }

      const videoCount = account._count.videos;
      // Cascade delete removes videos and snapshots
      await db.trackedAccount.delete({ where: { id: account.id } });

      return {
        content: [
          { type: "text", text: JSON.stringify({ removed: true, videosDeleted: videoCount }) },
        ],
      };
    }
  );
}
```

- [ ] **Step 2: Add import to server.ts**

Add to `src/mcp/server.ts`:
```typescript
import { registerAccountTools } from "./tools/accounts";
```

And call `registerAccountTools(server);` after `registerVideoTools(server);`.

- [ ] **Step 3: Test tools list includes account tools**

```bash
cd /Users/shubh/workspace/oncourse/social-dashboard && echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-11-25","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}
{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' | pnpm mcp 2>/dev/null
```

Expected: All 8 tools listed (4 video + 4 account).

- [ ] **Step 4: Commit**

```bash
git add src/mcp/
git commit -m "feat(mcp): implement account tools (search, details, add, remove)"
```

---

### Task 6: Implement research_profile tool

**Files:**
- Create: `src/mcp/tools/research.ts`
- Modify: `src/mcp/server.ts` (add import)

- [ ] **Step 1: Create research.ts**

```typescript
import type { McpServer } from "@modelcontextprotocol/sdk/server";
import type { CallToolResult } from "@modelcontextprotocol/sdk/server";
import * as z from "zod/v4";
import { getApifyClient, getDatasetItems } from "@/lib/apify";

export function registerResearchTools(server: McpServer) {
  server.registerTool(
    "research_profile",
    {
      title: "Research Profile",
      description:
        "Live lookup of any TikTok profile via Apify. Returns follower count, total likes, bio, and avatar. Note: this calls an external API and may take 10-30 seconds. Consumes Apify credits.",
      annotations: { readOnlyHint: true },
      inputSchema: z.object({
        username: z.string().describe("TikTok username to research (with or without @)"),
      }),
    },
    async ({ username }): Promise<CallToolResult> => {
      const cleanUsername = username.replace(/^@/, "");

      try {
        const client = getApifyClient();
        const actorId = process.env.APIFY_ACTOR_ID || "clockworks/tiktok-profile-scraper";

        const run = await client.actor(actorId).call({
          profiles: [cleanUsername],
          resultsPerPage: 100,
        });

        const items = await getDatasetItems(run.defaultDatasetId);

        if (!items.length) {
          return { content: [{ type: "text", text: `Profile not found: @${cleanUsername}` }], isError: true };
        }

        const firstItem = items[0] as Record<string, unknown>;
        const authorMeta = (firstItem.authorMeta ?? {}) as Record<string, unknown>;

        const profile = {
          username: (authorMeta.name ?? cleanUsername) as string,
          displayName: (authorMeta.nickName ?? null) as string | null,
          followers: (authorMeta.fans ?? 0) as number,
          totalLikes: (authorMeta.heart ?? 0) as number,
          bio: (authorMeta.signature ?? null) as string | null,
          avatarUrl: (authorMeta.avatar ?? null) as string | null,
          totalVideos: (authorMeta.video ?? items.length) as number,
        };

        return { content: [{ type: "text", text: JSON.stringify(profile, null, 2) }] };
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
```

- [ ] **Step 2: Add import to server.ts**

Add `import { registerResearchTools } from "./tools/research";` and call `registerResearchTools(server);`.

- [ ] **Step 3: Commit**

```bash
git add src/mcp/
git commit -m "feat(mcp): implement research_profile tool (Apify live lookup)"
```

---

### Task 7: Implement manage_apps tool

**Files:**
- Create: `src/mcp/tools/apps.ts`
- Modify: `src/mcp/server.ts` (add import)

- [ ] **Step 1: Create apps.ts**

```typescript
import type { McpServer } from "@modelcontextprotocol/sdk/server";
import type { CallToolResult } from "@modelcontextprotocol/sdk/server";
import * as z from "zod/v4";
import { db } from "@/lib/db";

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
        name: z.string().optional().describe("App name (required for create/delete)"),
        color: z.string().optional().describe("Hex color (required for create, e.g. '#3b82f6')"),
        url: z.string().optional().describe("Optional URL for the app"),
      }),
    },
    async (input): Promise<CallToolResult> => {
      if (input.action === "list") {
        const apps = await db.app.findMany({
          include: {
            _count: { select: { trackedAccounts: true } },
            trackedAccounts: {
              select: { followers: true, totalLikes: true, _count: { select: { videos: true } } },
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
          totalFollowers: app.trackedAccounts.reduce((sum, a) => sum + a.followers, 0),
          totalLikes: app.trackedAccounts.reduce((sum, a) => sum + a.totalLikes, 0),
          totalVideos: app.trackedAccounts.reduce((sum, a) => sum + a._count.videos, 0),
        }));

        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      if (input.action === "create") {
        if (!input.name || !input.color) {
          return { content: [{ type: "text", text: "name and color are required for create" }], isError: true };
        }
        const app = await db.app.create({
          data: { name: input.name, color: input.color, url: input.url ?? null },
        });
        return { content: [{ type: "text", text: JSON.stringify(app, null, 2) }] };
      }

      if (input.action === "delete") {
        if (!input.name) {
          return { content: [{ type: "text", text: "name is required for delete" }], isError: true };
        }
        const app = await db.app.findUnique({ where: { name: input.name } });
        if (!app) {
          return { content: [{ type: "text", text: `App not found: "${input.name}"` }], isError: true };
        }
        await db.app.delete({ where: { id: app.id } });
        return { content: [{ type: "text", text: JSON.stringify({ deleted: true, name: input.name }) }] };
      }

      return { content: [{ type: "text", text: "Invalid action" }], isError: true };
    }
  );
}
```

- [ ] **Step 2: Add import to server.ts**

Add `import { registerAppTools } from "./tools/apps";` and call `registerAppTools(server);`.

- [ ] **Step 3: Commit**

```bash
git add src/mcp/
git commit -m "feat(mcp): implement manage_apps tool (list, create, delete)"
```

---

### Task 8: Implement get_analytics tool

**Files:**
- Create: `src/mcp/tools/analytics.ts`
- Modify: `src/mcp/server.ts` (add import)

- [ ] **Step 1: Create analytics.ts**

```typescript
import type { McpServer } from "@modelcontextprotocol/sdk/server";
import type { CallToolResult } from "@modelcontextprotocol/sdk/server";
import * as z from "zod/v4";
import { db } from "@/lib/db";
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

      // Date filter
      if (input.dateRange !== "all") {
        const days = input.dateRange === "7d" ? 7 : input.dateRange === "90d" ? 90 : 30;
        const since = new Date();
        since.setDate(since.getDate() - days);
        where.postedAt = { gte: since };
      }

      if (input.appName) {
        where.account = { app: { name: input.appName } };
      }

      const settings = await db.settings.findFirst({ where: { id: "default" } });
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

      // Group videos
      const groups = new Map<
        string,
        { videos: typeof videos; totalViews: number; viralCount: number; topVideo: (typeof videos)[0] | null }
      >();

      for (const video of videos) {
        let key: string;
        if (input.groupBy === "account") key = video.account.username;
        else if (input.groupBy === "format") key = video.format;
        else key = video.account.app.name;

        if (!groups.has(key)) {
          groups.set(key, { videos: [], totalViews: 0, viralCount: 0, topVideo: null });
        }
        const g = groups.get(key)!;
        g.videos.push(video);
        g.totalViews += video.views;
        if (video.views >= viralThreshold) g.viralCount++;
        if (!g.topVideo || video.views > g.topVideo.views) g.topVideo = video;
      }

      const result = Array.from(groups.entries())
        .map(([group, data]) => ({
          group,
          totalVideos: data.videos.length,
          totalViews: data.totalViews,
          avgViews: Math.round(data.totalViews / data.videos.length),
          viralCount: data.viralCount,
          topVideo: data.topVideo
            ? {
                tiktokVideoId: data.topVideo.tiktokVideoId,
                description: data.topVideo.description.slice(0, 100),
                views: data.topVideo.views,
              }
            : null,
        }))
        .sort((a, b) => b.totalViews - a.totalViews);

      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );
}
```

- [ ] **Step 2: Add import to server.ts**

Add `import { registerAnalyticsTools } from "./tools/analytics";` and call `registerAnalyticsTools(server);`.

- [ ] **Step 3: Finalize server.ts**

The final `src/mcp/server.ts` should look like:

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server";
import { registerVideoTools } from "./tools/videos";
import { registerAccountTools } from "./tools/accounts";
import { registerResearchTools } from "./tools/research";
import { registerAppTools } from "./tools/apps";
import { registerAnalyticsTools } from "./tools/analytics";

export function createServer() {
  const server = new McpServer(
    {
      name: "social-dashboard",
      version: "1.0.0",
    },
    {
      capabilities: { logging: {} },
    }
  );

  registerVideoTools(server);
  registerAccountTools(server);
  registerResearchTools(server);
  registerAppTools(server);
  registerAnalyticsTools(server);

  return server;
}
```

- [ ] **Step 4: Commit**

```bash
git add src/mcp/
git commit -m "feat(mcp): implement get_analytics tool and finalize server"
```

---

### Task 9: End-to-end smoke test

**Files:** None (testing only)

- [ ] **Step 1: Verify all 11 tools are listed**

```bash
cd /Users/shubh/workspace/oncourse/social-dashboard && echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-11-25","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}
{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' | pnpm mcp 2>/dev/null
```

Expected: 11 tools listed — `search_videos`, `get_video_details`, `get_viral_hooks`, `add_videos`, `search_accounts`, `get_account_details`, `add_account`, `remove_account`, `research_profile`, `manage_apps`, `get_analytics`.

- [ ] **Step 2: Test a read tool (manage_apps list)**

```bash
cd /Users/shubh/workspace/oncourse/social-dashboard && echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-11-25","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}
{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"manage_apps","arguments":{"action":"list"}}}' | pnpm mcp 2>/dev/null
```

Expected: JSON response with the list of apps from your database.

- [ ] **Step 3: Test search_videos tool**

```bash
cd /Users/shubh/workspace/oncourse/social-dashboard && echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-11-25","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}
{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"search_videos","arguments":{"limit":3,"sortBy":"views"}}}' | pnpm mcp 2>/dev/null
```

Expected: Top 3 videos by views from the database.

- [ ] **Step 4: Fix any issues found during testing**

If any tool fails, fix the issue in the relevant tool file and re-test.

- [ ] **Step 5: Commit any fixes**

```bash
git add -A && git commit -m "fix(mcp): address issues found during smoke testing"
```

(Skip this step if no fixes were needed.)

---

### Task 10: Add Claude Code MCP config

**Files:**
- Document only (not a code file)

- [ ] **Step 1: Print the Claude Code MCP config for the user**

The user needs to add this to their Claude Code MCP settings (`.claude/settings.json` or via `claude mcp add`):

```bash
claude mcp add social-dashboard -- pnpm --prefix /Users/shubh/workspace/oncourse/social-dashboard mcp
```

Or manually in `.claude/settings.json`:

```json
{
  "mcpServers": {
    "social-dashboard": {
      "command": "pnpm",
      "args": ["--prefix", "/Users/shubh/workspace/oncourse/social-dashboard", "mcp"],
      "env": {
        "DATABASE_URL": "<your-database-url>",
        "APIFY_API_KEY": "<your-apify-key>"
      }
    }
  }
}
```

- [ ] **Step 2: Add MCP_API_KEY to .env.example**

Add `MCP_API_KEY=` to `.env.example` so team members know to set it for HTTP transport.

- [ ] **Step 3: Commit**

```bash
git add .env.example
git commit -m "docs(mcp): add MCP_API_KEY to .env.example"
```
