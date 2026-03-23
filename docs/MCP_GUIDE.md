# Social Dashboard MCP Server — Integration Guide

An MCP (Model Context Protocol) server that exposes TikTok competitor intelligence data to AI agents. Search videos, manage tracked accounts, research profiles, query analytics, and push video data — all through standardized MCP tools.

## Quick Start

### Claude Code

```bash
claude mcp add social-dashboard -- pnpm --prefix /path/to/social-dashboard mcp
```

Or with environment variables:

```bash
claude mcp add social-dashboard \
  -e DATABASE_URL="your-postgres-url" \
  -e APIFY_API_KEY="your-apify-key" \
  -e APIFY_ACTOR_ID="your-actor-id" \
  -- pnpm --prefix /path/to/social-dashboard mcp
```

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "social-dashboard": {
      "command": "pnpm",
      "args": ["--prefix", "/path/to/social-dashboard", "mcp"],
      "env": {
        "DATABASE_URL": "your-postgres-url",
        "APIFY_API_KEY": "your-apify-key",
        "APIFY_ACTOR_ID": "your-actor-id"
      }
    }
  }
}
```

### Cursor / Windsurf / Any MCP-Compatible IDE

Add to your IDE's MCP config (usually `.cursor/mcp.json` or equivalent):

```json
{
  "mcpServers": {
    "social-dashboard": {
      "command": "pnpm",
      "args": ["--prefix", "/path/to/social-dashboard", "mcp"],
      "env": {
        "DATABASE_URL": "your-postgres-url"
      }
    }
  }
}
```

### Remote Agents (HTTP Transport)

Start the HTTP server:

```bash
MCP_API_KEY="your-secret-key" pnpm mcp:http
```

Connect any MCP client to `http://localhost:3100` with header `Authorization: Bearer your-secret-key`.

Set `MCP_PORT` to change the port (default 3100).

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `APIFY_API_KEY` | For research | Apify API key (needed for `research_profile` tool) |
| `APIFY_ACTOR_ID` | For research | Apify actor ID for TikTok scraping |
| `MCP_API_KEY` | For HTTP | Bearer token for HTTP transport auth |
| `MCP_PORT` | No | HTTP transport port (default 3100) |

## Available Tools

### Videos

#### `search_videos`

Search and filter TikTok videos across all tracked accounts.

```
Inputs:
  minViews?        number     Minimum view count
  maxViews?        number     Maximum view count
  format?          enum       UGC_REACTION | UGC_VOICEOVER | CAROUSEL_SLIDESHOW | OTHER
  accountUsername?  string     Filter to specific account
  appName?         string     Filter to specific app/competitor group
  hashtag?         string     Filter by hashtag
  dateFrom?        string     ISO date (e.g. "2026-01-01")
  dateTo?          string     ISO date
  relevant?        boolean    Filter by relevance flag (default: true)
  sortBy?          enum       views | likes | comments | shares | postedAt (default: views)
  sortOrder?       enum       asc | desc (default: desc)
  limit?           number     Max results, cap 100 (default: 20)
```

Example: "Find UGC reaction videos with over 50K views from the last 7 days"

#### `get_video_details`

Get full details for a specific video including snapshots.

```
Inputs:
  tiktokVideoId    string     Required. The TikTok video ID
```

#### `get_viral_hooks`

Extract top-performing hooks, scripts, and CTAs from viral videos.

```
Inputs:
  minViews?        number     Minimum views to consider viral (default: 5000)
  format?          enum       UGC_REACTION | UGC_VOICEOVER | CAROUSEL_SLIDESHOW | OTHER
  appName?         string     Filter to specific app
  limit?           number     Max results (default: 20)
```

Example: "What hooks are working best for UWorld competitors?"

#### `add_videos`

Push video data into the database for a tracked account. Upserts by `tiktokVideoId`.

```
Inputs:
  username         string     Required. Username of the tracked account
  videos           array      Required. Array of video objects:
    tiktokVideoId  string     Required
    description    string     Required
    views          number     Required
    likes          number     Required
    comments       number     Required
    shares         number     Required
    postedAt       string     Required. ISO date
    duration?      number     Default: 0
    hashtags?      string[]   Default: []
    thumbnailUrl?  string
    videoUrl?      string
    musicName?     string
    isCarousel?    boolean    Default: false
```

### Accounts

#### `search_accounts`

Search tracked TikTok accounts.

```
Inputs:
  appName?         string     Filter to specific app
  minFollowers?    number
  maxFollowers?    number
  sortBy?          enum       followers | totalLikes | totalVideos | lastPostedAt (default: followers)
  limit?           number     Default: 20
```

#### `get_account_details`

Full account info with viral counts and recent videos.

```
Inputs:
  username         string     Required. TikTok username
```

#### `add_account`

Start tracking a new TikTok account.

```
Inputs:
  username         string     Required. TikTok username (with or without @)
  appName          string     Required. Name of the app/competitor group
```

#### `remove_account`

Stop tracking an account. Deletes all stored video data. **Destructive.**

```
Inputs:
  username         string     Required. TikTok username
```

### Research

#### `research_profile`

Live lookup of any TikTok profile via Apify. Takes 10-30 seconds. Consumes Apify credits.

```
Inputs:
  username         string     Required. TikTok username (with or without @)
```

Returns: username, displayName, followers, totalLikes, bio, avatarUrl, totalVideos

### Apps (Competitor Groups)

#### `manage_apps`

List, create, or delete apps.

```
Inputs:
  action           enum       Required. list | create | delete
  name?            string     Required for create/delete
  color?           string     Required for create (hex, e.g. "#3b82f6")
  url?             string     Optional for create
```

### Analytics

#### `get_analytics`

Aggregated performance summaries.

```
Inputs:
  appName?         string     Filter to specific app
  dateRange?       enum       7d | 30d | 90d | all (default: 30d)
  groupBy?         enum       app | account | format (default: app)
```

Returns per group: totalVideos, totalViews, avgViews, viralCount, topVideo

## Example Agent Workflows

**Competitor Discovery:**
1. `research_profile` — Look up a new TikTok account
2. `manage_apps` (create) — Create a competitor group if needed
3. `add_account` — Start tracking the account
4. `add_videos` — Push their video data

**Content Strategy Analysis:**
1. `get_viral_hooks` — Find what hooks are working
2. `search_videos` — Deep dive into specific formats or apps
3. `get_analytics` — Compare performance across competitors

**Weekly Report:**
1. `get_analytics` (7d, groupBy: app) — This week's performance by competitor
2. `search_videos` (dateFrom: last week, sortBy: views) — Top performing videos
3. `get_viral_hooks` (minViews: 50000) — Breakout hooks

## Troubleshooting

**Server won't start:** Ensure `DATABASE_URL` is set and the database is accessible.

**`research_profile` fails:** Check `APIFY_API_KEY` and `APIFY_ACTOR_ID` are set.

**HTTP transport 401:** Verify `MCP_API_KEY` matches your `Authorization: Bearer` header.

**Tools not appearing:** Restart your AI agent/IDE after adding the MCP config.
