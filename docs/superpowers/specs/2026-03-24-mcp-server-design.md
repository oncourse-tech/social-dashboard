# MCP Server for Social Dashboard

## Overview

An MCP (Model Context Protocol) server that exposes the social-dashboard's TikTok competitor intelligence data to AI agents. Enables agents to search videos, manage tracked accounts, research new profiles, query analytics, and push video data — all through standardized MCP tools.

## Consumers

1. **Local (personal)** — Claude Code / Claude Desktop via stdio transport
2. **Team agents** — Other team members' AI assistants via HTTP transport
3. **Automated agents** — Cron-driven discovery bots, content creation agents via HTTP transport

## Architecture

### File Structure

```
src/mcp/
├── server.ts              # MCP server setup, tool registration
├── tools/
│   ├── videos.ts          # search_videos, get_video_details, get_viral_hooks
│   ├── accounts.ts        # search_accounts, get_account_details, add_account, remove_account
│   ├── research.ts        # research_profile
│   ├── apps.ts            # manage_apps
│   └── analytics.ts       # get_analytics
└── transports/
    ├── stdio.ts           # Entry point for local use
    └── http.ts            # Entry point for remote agents
```

### Key Decisions

- **Direct DB access** via shared Prisma client from `src/lib/db.ts` — no API route indirection
- **Apify client** imported from `src/lib/apify.ts` for the `research_profile` tool
- **Single new dependency:** `@modelcontextprotocol/sdk`
- **Two transports:**
  - `stdio` for local Claude Code/Desktop — no auth
  - Streamable HTTP for team/remote agents — bearer token auth via `MCP_API_KEY` env var
- **Tool design:** Flat list of 11 goal-oriented tools (not API mirrors)

### Package.json Scripts

```json
{
  "mcp": "tsx src/mcp/transports/stdio.ts",
  "mcp:http": "tsx src/mcp/transports/http.ts"
}
```

## Tool Specifications

### 1. `search_videos`

Search and filter videos across all tracked accounts.

**Input:**
| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| minViews | number | no | — | Minimum view count |
| maxViews | number | no | — | Maximum view count |
| format | enum | no | — | UGC_REACTION, UGC_VOICEOVER, CAROUSEL_SLIDESHOW, OTHER |
| accountUsername | string | no | — | Filter to specific account |
| appName | string | no | — | Filter to specific app |
| hashtag | string | no | — | Filter by hashtag |
| dateFrom | string (ISO) | no | — | Start date |
| dateTo | string (ISO) | no | — | End date |
| relevant | boolean | no | true | Filter by relevance flag |
| sortBy | enum | no | views | views, likes, comments, shares, postedAt |
| sortOrder | enum | no | desc | asc, desc |
| limit | number | no | 20 | Max results (cap 100) |

**Output:** Array of `{ tiktokVideoId, description, views, likes, comments, shares, postedAt, format, hook, cta, accountUsername, appName }`

### 2. `get_video_details`

Get full details for a specific video including snapshots.

**Input:**
| Field | Type | Required |
|---|---|---|
| tiktokVideoId | string | yes |

**Output:** Full video record + account info + historical snapshots

### 3. `get_viral_hooks`

Extract top-performing hooks, scripts, and CTAs from viral videos.

**Input:**
| Field | Type | Required | Default |
|---|---|---|---|
| minViews | number | no | 5000 |
| format | enum | no | — |
| appName | string | no | — |
| limit | number | no | 20 |

**Output:** Array of `{ hook, script, cta, views, format, description, accountUsername, tiktokVideoId }`

### 4. `search_accounts`

Search tracked accounts with filters.

**Input:**
| Field | Type | Required | Default |
|---|---|---|---|
| appName | string | no | — |
| minFollowers | number | no | — |
| maxFollowers | number | no | — |
| sortBy | enum | no | followers |
| limit | number | no | 20 |

**Output:** Array of `{ username, displayName, followers, totalLikes, totalVideos, lastPostedAt, appName }`

### 5. `get_account_details`

Get full account info with video stats.

**Input:**
| Field | Type | Required |
|---|---|---|
| username | string | yes |

**Output:** Full account record + app info + video count + viral counts + recent 10 videos

### 6. `add_account`

Start tracking a new TikTok account.

**Input:**
| Field | Type | Required |
|---|---|---|
| username | string | yes |
| appName | string | yes |

**Output:** `{ id, username, appName, trackingSince }`

### 7. `remove_account`

Stop tracking an account and delete its video data.

**Input:**
| Field | Type | Required |
|---|---|---|
| username | string | yes |

**Output:** `{ removed: true, videosDeleted: number }`

### 8. `research_profile`

Live lookup of any TikTok profile via Apify. May take 10-30s.

**Input:**
| Field | Type | Required |
|---|---|---|
| username | string | yes |

**Output:** `{ username, displayName, followers, totalLikes, bio, avatarUrl, totalVideos }`

### 9. `manage_apps`

List, create, or delete competitor groups (apps).

**Input:**
| Field | Type | Required | Notes |
|---|---|---|---|
| action | enum | yes | list, create, delete |
| name | string | for create/delete | App name |
| color | string | for create | Hex color |
| url | string | no | Optional URL |

**Output:** App object or array of apps with stats (accountCount, totalFollowers, totalLikes, totalVideos, viral counts)

### 10. `get_analytics`

Cross-app/account performance summaries.

**Input:**
| Field | Type | Required | Default |
|---|---|---|---|
| appName | string | no | — |
| dateRange | enum | no | 30d |
| groupBy | enum | no | app |

`dateRange`: 7d, 30d, 90d, all
`groupBy`: app, account, format

**Output:** Array of `{ group, totalVideos, totalViews, avgViews, viralCount, topVideo }`

### 11. `add_videos`

Push video data into the database for a tracked account. Upserts by tiktokVideoId.

**Input:**
| Field | Type | Required |
|---|---|---|
| username | string | yes |
| videos | array | yes |

Each video in the array:
| Field | Type | Required | Default |
|---|---|---|---|
| tiktokVideoId | string | yes | — |
| description | string | yes | — |
| views | number | yes | — |
| likes | number | yes | — |
| comments | number | yes | — |
| shares | number | yes | — |
| postedAt | string (ISO) | yes | — |
| duration | number | no | 0 |
| hashtags | string[] | no | [] |
| thumbnailUrl | string | no | null |
| videoUrl | string | no | null |
| musicName | string | no | null |
| isCarousel | boolean | no | false |

**Output:** `{ inserted: number, skipped: number, total: number }`

## Authentication

- **stdio transport:** No auth (local use only)
- **HTTP transport:** Bearer token via `MCP_API_KEY` environment variable. Simple shared key to start; OAuth 2.1 can be added later for per-user scoping.

## Tool Annotations

Each tool will include MCP tool annotations:
- `search_videos`, `get_video_details`, `get_viral_hooks`, `search_accounts`, `get_account_details`, `get_analytics`: `readOnlyHint: true`
- `add_account`, `remove_account`, `manage_apps`, `add_videos`: `readOnlyHint: false`
- `research_profile`: `readOnlyHint: true` (but note: consumes Apify credits)
- `remove_account` and `manage_apps` (delete): `destructiveHint: true`
