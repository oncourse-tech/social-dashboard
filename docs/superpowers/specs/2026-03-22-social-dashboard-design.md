# oncourse Social Dashboard — Design Spec

## Overview

A TikTok competitor intelligence dashboard for the oncourse marketing team. Track competitor medical education creators on TikTok, monitor their video performance, identify viral formats, and surface actionable insights for oncourse's own TikTok strategy.

**Phase 1 (this spec):** Competitor Intel — tracking, analytics, viral detection.
**Phase 2 (future):** Content House — saved formats, hook library, compositions, content calendar.

## Users

- oncourse marketing/content team (2-5 people)
- Basic auth (NextAuth.js with email/password or Google OAuth)
- Everyone sees everything — no role-based access

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS + shadcn/ui |
| Database | PostgreSQL (Supabase or Neon, free tier) |
| ORM | Prisma |
| Auth | NextAuth.js |
| Data Source | Apify TikTok scrapers (~$30-60/mo) |
| AI Classification | Gemini 3.1 Pro (video format labeling) |
| Tables | TanStack Table |
| Deployment | Vercel |
| Cron | Vercel Cron (daily sync trigger) |

## Architecture

Monolithic Next.js app on Vercel. Single codebase, single deployment.

### Data Flow

1. **Vercel Cron** triggers daily at a configured time
2. API route calls **Apify** to run TikTok Profile Scraper + Video Scraper for all tracked accounts
3. Apify completes scraping → sends results via **webhook** to `/api/sync/webhook`
4. Webhook handler parses JSON, upserts profiles and videos into **PostgreSQL** via Prisma
5. For each **new video**, queue a **Gemini 3.1 Pro** call to classify the video format
6. Dashboard pages query Prisma with server components, render data

### Sync Pipeline Detail

```
Vercel Cron (daily)
  → POST /api/sync/trigger
    → Creates SyncLog (status: running)
    → Calls Apify API: run TikTok Scraper actor (profiles + videos in one run)
    → Apify run completes → webhook callback

POST /api/sync/webhook (Apify callback, single call per sync run)
  → Parse Apify dataset results
  → For each account:
    → Upsert Account record (update followers, likes, totalVideos)
    → Create AccountSnapshot (daily growth record)
  → For each video:
    → Upsert Video record (update views, likes, comments, shares)
    → Create VideoSnapshot (daily engagement record)
    → If new video: call Gemini 3.1 Pro to classify format
  → Update SyncLog (status: completed, counts)
```

## Data Model

### Core Entities

#### App
Represents a competitor product/brand (e.g., Marrow, PrepLadder, Osmosis).

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| name | String | Unique, display name |
| color | String | Hex color for UI badges |
| url | String? | Product website |
| createdAt | DateTime | |
| updatedAt | DateTime | |

#### Account
A tracked TikTok creator, belongs to one App.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| username | String | Unique, TikTok handle (without @) |
| tiktokId | String? | TikTok's internal user ID |
| displayName | String? | |
| bio | String? | |
| avatarUrl | String? | |
| followers | Int | Latest count |
| totalLikes | Int | Latest count |
| totalVideos | Int | Latest count |
| trackingSince | DateTime | When we started tracking |
| lastSyncedAt | DateTime? | Last successful sync |
| lastPostedAt | DateTime? | Date of most recent video |
| appId | UUID | FK → App |

#### Video
An individual TikTok post.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| tiktokVideoId | String | Unique, TikTok's video ID |
| description | Text | Caption/description |
| hashtags | String[] | Extracted hashtag array |
| thumbnailUrl | String? | |
| videoUrl | String? | Direct link to TikTok video |
| duration | Int | Seconds |
| postedAt | DateTime | When posted on TikTok |
| views | Int | Latest count |
| likes | Int | Latest count |
| comments | Int | Latest count |
| shares | Int | Latest count |
| isCarousel | Boolean | Carousel/slideshow post |
| musicName | String? | Sound/music used |
| format | Enum | AI-classified format (see Format Enum) |
| accountId | UUID | FK → Account |

#### Format Enum

Single format label per video, auto-classified by Gemini 3.1 Pro.

| Value | Description |
|-------|-------------|
| UGC_REACTION | Creator reacting to content, duets, stitches |
| UGC_VOICEOVER | Creator voiceover on screen recordings, slides, or b-roll |
| TALKING_HEAD | Creator speaking directly to camera |
| CAROUSEL_SLIDESHOW | Image/text slides, educational content, tips lists |
| SCREEN_RECORDING | App demo, tutorial walkthrough, software showcase |
| SKIT_COMEDY | Scripted comedic scenarios, relatable situations |
| GREEN_SCREEN | Creator over a background image/article/screenshot |
| TEXT_ON_SCREEN | Primarily text overlays with music, no face |
| INTERVIEW_PODCAST | Clip from longer conversation |
| WHITEBOARD | Drawing, writing, diagramming on screen |
| BEFORE_AFTER | Transformation or comparison format |
| ASMR_AESTHETIC | Satisfying visuals, study-with-me, desk setups |
| OTHER | Unclassified |

#### AccountSnapshot
Daily snapshot of account-level metrics for growth tracking.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| accountId | UUID | FK → Account |
| followers | Int | |
| totalLikes | Int | |
| totalVideos | Int | |
| recordedAt | DateTime | Snapshot timestamp |

Unique constraint: (accountId, recordedAt::date) — one snapshot per account per day.

#### VideoSnapshot
Daily snapshot of video engagement for tracking how videos gain traction.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| videoId | UUID | FK → Video |
| views | Int | |
| likes | Int | |
| comments | Int | |
| shares | Int | |
| recordedAt | DateTime | Snapshot timestamp |

Unique constraint: (videoId, recordedAt::date) — one snapshot per video per day.

#### SyncLog
Audit trail for sync jobs.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| status | Enum | RUNNING, COMPLETED, FAILED |
| startedAt | DateTime | |
| completedAt | DateTime? | |
| accountsSynced | Int | Default 0 |
| videosSynced | Int | Default 0 |
| newVideos | Int | Default 0 |
| errors | Json? | Error details if any |

#### User
Dashboard users (small team).

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| email | String | Unique |
| name | String? | |
| image | String? | Avatar |
| createdAt | DateTime | |

### Key Indexes

- `Account.username` — unique, frequent lookups during sync
- `Account.appId` — filter accounts by app
- `Video.accountId` — all videos for an account
- `Video.postedAt` — sort by recency
- `Video.views` — sort/filter by virality
- `Video.format` — filter by format type
- `Video.tiktokVideoId` — unique, upsert during sync
- `AccountSnapshot.(accountId, recordedAt)` — unique compound
- `VideoSnapshot.(videoId, recordedAt)` — unique compound

## Pages & Features

### Sidebar Navigation

```
COMPETITOR INTEL
├── Apps
├── Accounts
├── Account Research
├── Posting Activity
├── Viral Videos
├── All Videos
└── Bulk Import

SYSTEM
├── Settings
└── Sync Status
```

### Page Specifications

#### 1. Apps Overview (`/apps`)

**Purpose:** High-level view of all tracked competitor apps and their aggregate performance.

**Summary Cards:**
- Total Apps
- Total Accounts
- Total Videos
- Videos (7d) — posted in last 7 days
- \>5K Views — videos above first viral threshold
- \>50K Views — videos above second viral threshold

**Table Columns:**
| Column | Sortable | Notes |
|--------|----------|-------|
| App | Yes | Color badge + name |
| Accounts | Yes | Count of tracked accounts |
| Followers | Yes | Sum across accounts |
| Likes | Yes | Sum across accounts |
| Videos | Yes | Total video count |
| 7d | Yes | Videos posted in last 7 days |
| 5K+ | Yes | Videos with 5K+ views (configurable) |
| 50K+ | Yes | Videos with 50K+ views (configurable) |
| Actions | No | Delete button, external link |

**Actions:**
- "+ Add App" button → modal with name, color picker, optional URL
- Delete app (with confirmation — cascades to accounts)
- Click app row → navigate to Accounts filtered by that app

#### 2. Accounts (`/accounts?app=<id>`)

**Purpose:** View all tracked creators for a specific app (or all apps).

**Summary Cards:**
- Total Accounts (for selected app)
- Total Followers
- Total Videos

**Filters:**
- App dropdown (filter by app, or "All")
- Search by username

**Table Columns:**
| Column | Sortable | Notes |
|--------|----------|-------|
| Account | Yes | @username |
| App | Yes | Color badge |
| Last Posted | Yes | Date of most recent video |
| Followers | Yes | |
| Likes | Yes | Total likes |
| Videos | Yes | Total video count |
| 7d | Yes | Videos posted in last 7 days |
| 5K+ | Yes | Viral video count (first threshold) |
| 10K+ | Yes | Viral video count (mid threshold) |
| 50K+ | Yes | Viral video count (second threshold) |
| Actions | No | External TikTok link |

**Actions:**
- "+ Add Account" button → modal with username input, app selector
- Click account row → navigate to Account Detail

#### 3. Account Detail (`/accounts/[username]`)

**Purpose:** Deep dive into a single creator's profile and video performance.

**Header:**
- Avatar, @username, App badge, "Tracking since" date
- "View on TikTok" external link button

**Stats Cards:**
- Followers
- Total Likes
- Total Videos
- Viral Videos (count + threshold breakdown, e.g., "6 (2 50K+)")

**Videos Section:**
- Toggle: Grid view (thumbnail cards) / List view (table)
- Search by description/hashtag
- Filter dropdown: All Videos / Viral Only / by Format
- Video count display

**Grid View — each card shows:**
- Thumbnail with play icon
- Views + likes overlay
- Posted date
- Description (truncated)
- Hashtags (colored)
- Comments + shares count
- Format badge

**List View — table columns:**
| Column | Sortable | Notes |
|--------|----------|-------|
| Description | No | Truncated, with hashtags below |
| Posted | Yes | Date |
| Views | Yes | |
| Likes | Yes | |
| Comments | Yes | |
| Shares | Yes | |
| Format | Yes | Format badge |
| Tier | Yes | Viral tier badge (5K+, 10K+, 50K+) |
| Link | No | External TikTok link |

#### 4. Account Research (`/research`)

**Purpose:** Discover new TikTok accounts to track.

**Features:**
- Search input: enter a TikTok username or keyword
- Triggers Apify search or direct profile lookup
- Preview results: avatar, username, followers, likes, video count, bio
- "Add to Tracking" button per result → select app, confirm
- Recently searched history

#### 5. Posting Activity (`/activity`)

**Purpose:** Visualize when competitors post to identify posting patterns.

**Features:**
- Heatmap or timeline view showing posts over time
- Filter by app, account, date range
- Identify peak posting times and frequency patterns
- Aggregated view: "Most posts on Tuesdays at 2pm" type insights

#### 6. Viral Videos (`/viral`)

**Purpose:** Surface only high-performing content across all tracked accounts.

**Filters:**
- Viral threshold selector (configurable, default 5K+ and 50K+)
- App filter
- Format filter
- Date range
- Sort by: views, likes, recency, growth rate

**Display:**
- Same grid/list toggle as Account Detail
- Each video shows: thumbnail, creator, app badge, views, likes, format, posted date
- Click → opens TikTok video in new tab

#### 7. All Videos (`/videos`)

**Purpose:** Unfiltered video browser across all tracked accounts.

**Features:**
- Full search (description, hashtags)
- Filters: app, account, format, date range, min views
- Sort by any metric
- Grid + list view toggle
- Pagination (cursor-based for performance)

#### 8. Bulk Import (`/import`)

**Purpose:** Batch-add multiple accounts at once.

**Features:**
- Text area: paste usernames (one per line) or CSV upload
- App selector (assign all to one app)
- Preview list before importing
- Progress indicator during import
- Results summary: added, already tracked, not found

### System Pages

#### Settings (`/settings`)

- **Viral Thresholds:** configure view count thresholds (default 5K, 50K)
- **Apify Config:** API key, actor IDs
- **Gemini Config:** API key for format classification
- **Sync Schedule:** cron expression or simple time picker
- **Team:** invite/remove team members

#### Sync Status (`/sync`)

- Last sync timestamp
- Sync history table (date, status, accounts synced, videos synced, errors)
- "Sync Now" manual trigger button
- Current sync progress (if running)

## AI Classification Pipeline

### Format Classification

When new videos are ingested during sync:

1. Collect video metadata: description, hashtags, thumbnail URL, duration, music name
2. Call Gemini 3.1 Pro with a structured prompt:
   - Input: video metadata + thumbnail (if available)
   - Output: one of the Format enum values
   - Use structured output (JSON mode) for reliable parsing
3. Update the video's `format` field
4. If Gemini call fails, set format to `OTHER` and log the error

### Classification Prompt Template

```
Classify this TikTok video into exactly one format category based on the metadata provided.

Video metadata:
- Description: {description}
- Hashtags: {hashtags}
- Duration: {duration}s
- Music: {musicName}
- Thumbnail: {thumbnailUrl}

Categories:
- UGC_REACTION: Creator reacting to content, duets, stitches
- UGC_VOICEOVER: Creator voiceover on screen recordings, slides, or b-roll
- TALKING_HEAD: Creator speaking directly to camera
- CAROUSEL_SLIDESHOW: Image/text slides, educational content, tips lists
- SCREEN_RECORDING: App demo, tutorial walkthrough, software showcase
- SKIT_COMEDY: Scripted comedic scenarios, relatable situations
- GREEN_SCREEN: Creator over a background image/article/screenshot
- TEXT_ON_SCREEN: Primarily text overlays with music, no face
- INTERVIEW_PODCAST: Clip from longer conversation
- WHITEBOARD: Drawing, writing, diagramming on screen
- BEFORE_AFTER: Transformation or comparison format
- ASMR_AESTHETIC: Satisfying visuals, study-with-me, desk setups
- OTHER: Does not fit any category above

Respond with a JSON object: {"format": "<CATEGORY>"}
```

### Cost Estimate

- ~50 new videos/day across 200 creators (estimated)
- Gemini 3.1 Pro cost per classification: ~$0.001-0.005
- Daily cost: ~$0.05-0.25
- Monthly: ~$1.50-7.50

## Viral Detection Logic

Videos are tagged with viral tiers based on configurable view thresholds stored in Settings.

**Default thresholds:**
- Tier 1: 5,000+ views
- Tier 2: 50,000+ views

**Computed fields (not stored, calculated in queries):**
- `tier`: based on views vs thresholds
- `is7d`: posted within last 7 days
- `viralCount5K`: count of videos above tier 1 (per account/app)
- `viralCount50K`: count of videos above tier 2 (per account/app)

Users can change thresholds in Settings. All viral counts and badges recalculate dynamically.

## Error Handling

- **Apify failures:** SyncLog records error, dashboard shows last successful sync time, team notified
- **Gemini failures:** Video format set to OTHER, error logged, retry on next sync
- **Partial sync:** If some accounts fail, others still sync. SyncLog captures per-account errors in JSON
- **Rate limits:** Apify handles TikTok rate limits internally. Gemini calls are throttled to 10/sec

## Performance Considerations

- **Server components** for all data-heavy pages (no client-side data fetching for tables)
- **Cursor-based pagination** for All Videos (could be 25K+ rows)
- **Database indexes** on all frequently filtered/sorted columns
- **Incremental sync** — only fetch new/updated videos, not full history every time
- **Thumbnail caching** — store thumbnail URLs from Apify, lazy-load in grid view

## Phase 2: Content House (Future)

Not in scope for Phase 1. Will include:
- Saved Formats — bookmark viral videos as replicable templates
- Hook Library — collection of proven hooks
- Compositions — draft content ideas (format + hook + topic)
- Content Calendar — visual scheduling
- Our Accounts — track oncourse's own TikTok accounts
- AI Insights — trend analysis and content briefs

## Open Questions

1. **Database host:** Supabase or Neon? Both have free tiers with Prisma support.
2. **Apify actor selection:** Need to test specific TikTok scraper actors for reliability and data completeness.
3. **Gemini video analysis:** Can Gemini 3.1 Pro analyze actual video content (not just metadata/thumbnails)? If so, classification accuracy improves significantly.
4. **oncourse branding:** Should this dashboard have oncourse branding or be generic/white-label?
