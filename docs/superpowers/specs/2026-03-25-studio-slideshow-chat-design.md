# Studio Slideshow Chat UI — Design Spec

**Date:** 2026-03-25
**Status:** Draft

## Overview

Add a "Studio" section to the social-dashboard that provides a chat-based interface for generating photorealistic TikTok slideshows via the OpenClaw agent. The first format is Slideshows; the Studio structure supports future formats (UGC Hooks, Videos).

The user chats with the OpenClaw agent to describe a slideshow concept. The agent runs the `generate-photo-slides.js` script on the remote Mac, producing 6 photorealistic 1024x1536 PNG slides. The slides appear progressively in a persistent preview grid alongside the chat, similar to Midjourney's image generation experience.

## Route Structure

```
/studio                    — Landing page with format cards
/studio/slideshows         — Chat UI for slideshow generation
```

### `/studio` Landing Page

Displays format cards in a grid:

| Card | Status | Route |
|------|--------|-------|
| Slideshows | Active | `/studio/slideshows` |
| UGC Hooks | Coming Soon (disabled) | — |
| Videos | Coming Soon (disabled) | — |

Single "Studio" entry in the sidebar nav. Landing page is the entry point; format cards link to sub-pages.

### `/studio/slideshows` — Chat + Preview

Split panel layout:

- **Left panel (chat):** Message history + input. Powered by Vercel AI SDK `useChat` hook. Streams agent text responses in real time.
- **Right panel (preview):** Persistent 2x3 grid showing the current slideshow state. Updates in place as slides generate or regenerate. Does not scroll with chat.

## Infrastructure

### OpenClaw Gateway Access

The OpenClaw agent runs on a Mac (`sneha@100.120.211.69`) with the gateway at port `18789`. The gateway exposes an OpenAI-compatible `/v1/chat/completions` endpoint with SSE streaming support.

**Connectivity:** Tailscale Funnel exposes port 18789 as a public HTTPS URL. The Next.js API route connects to this URL server-side.

**Env vars:**
- `OPENCLAW_GATEWAY_URL` — Tailscale Funnel HTTPS URL (e.g. `https://snehas-macbook-air-55.tail008b78.ts.net`)
- `OPENCLAW_GATEWAY_TOKEN` — Bearer token for gateway auth

### Slide Image Pipeline

Slides are generated as PNGs on the Mac filesystem at `~/clawd-oncourse/tiktok-marketing/posts/photo/{slug}/`. They need to be accessible from the web.

**Flow:**
1. Agent generates slides on Mac → PNGs written to disk
2. Next.js API route SSHes into Mac, reads PNG files
3. Uploads to storage (Supabase Storage or S3)
4. Returns public CDN URLs to the frontend

This avoids exposing an additional Funnel and ensures slides load fast from CDN even if the Mac goes offline.

**SSH access:** Via Tailscale IP (`100.120.211.69`). Requires an SSH private key for the Vercel environment.

**Env vars (full list):**
- `OPENCLAW_GATEWAY_URL` — Tailscale Funnel HTTPS URL
- `OPENCLAW_GATEWAY_TOKEN` — Bearer token for gateway auth
- `OPENCLAW_SSH_HOST` — Tailscale IP of the Mac (e.g. `100.120.211.69`)
- `OPENCLAW_SSH_USER` — SSH username (e.g. `sneha`)
- `OPENCLAW_SSH_PRIVATE_KEY` — Base64-encoded SSH private key
- `STORAGE_BUCKET` — Supabase Storage bucket name for slide uploads

## API Routes

### `POST /api/studio/chat`

Proxies chat messages to the OpenClaw gateway.

**Request:** Standard Vercel AI SDK `useChat` format — array of messages.

**Implementation:**
```typescript
import { createOpenAI } from '@ai-sdk/openai';
import { streamText } from 'ai';

const openclaw = createOpenAI({
  baseURL: process.env.OPENCLAW_GATEWAY_URL + '/v1',
  apiKey: process.env.OPENCLAW_GATEWAY_TOKEN,
});

export async function POST(req: Request) {
  const { messages } = await req.json();
  const result = streamText({
    model: openclaw('openclaw:main'),
    messages,
  });
  return result.toDataStreamResponse();
}
```

The agent has the `tiktok-brain` skill loaded, so it handles the full slideshow generation pipeline when asked.

### `GET /api/studio/slides?slug={slug}`

Polls for slide generation status and fetches completed slides.

**Response:**
```json
{
  "slug": "med-student-weak-areas",
  "status": "generating",
  "slides": [
    { "index": 1, "url": "https://cdn.../slide_01.png", "status": "ready" },
    { "index": 2, "url": null, "status": "generating" },
    { "index": 3, "url": null, "status": "pending" },
    { "index": 4, "url": null, "status": "pending" },
    { "index": 5, "url": null, "status": "pending" },
    { "index": 6, "url": null, "status": "pending" }
  ],
  "manifest": null
}
```

**Implementation:**
1. SSH into Mac, check `~/clawd-oncourse/tiktok-marketing/posts/photo/{slug}/`
2. For each `slide_0N.png` that exists and hasn't been uploaded yet: read via SSH, upload to storage
3. If `manifest.json` exists: read and include in response
4. Return current state of all 6 slots

### `POST /api/studio/slides/regenerate`

Triggers regeneration of specific slides or the full set.

**Request:**
```json
{
  "slug": "med-student-weak-areas",
  "slideIndices": [3],        // optional — specific slides to regenerate
  "texts": ["...", "..."],    // optional — updated texts (all 6)
  "scene": "..."              // optional — updated scene description
}
```

**Implementation:** Sends a follow-up message to the OpenClaw agent via the gateway instructing it to regenerate. The full conversation history (from `useChat`) is included in the request so the agent has context about what to regenerate. The frontend manages conversation state; no server-side session storage needed.

## Frontend Components

### `StudioLandingPage` — `/studio/page.tsx`

Grid of format cards. Each card shows:
- Icon
- Format name
- Short description
- Status badge (Active / Coming Soon)

Active cards link to their sub-route. Coming Soon cards are visually dimmed and not clickable.

### `SlideshowStudioPage` — `/studio/slideshows/page.tsx`

Split panel layout using CSS grid or flexbox:
- Left: `<ChatPanel />`
- Right: `<PreviewPanel />`

### `ChatPanel`

- Uses Vercel AI SDK `useChat` hook pointed at `/api/studio/chat`
- Renders message bubbles (user right-aligned, agent left-aligned)
- Streaming text appears incrementally
- Input bar at bottom with send button
- Parses agent messages for slide-ready signals (manifest path pattern: `MANIFEST:/path/to/manifest.json`)
- When a manifest signal is detected, triggers the `PreviewPanel` to start polling

### `PreviewPanel`

- 2x3 CSS grid of slide slots
- Each slot has 3 states:
  - **Empty:** Dark placeholder
  - **Generating:** Spinner/pulse animation
  - **Ready:** Slide image thumbnail (click to open lightbox)
- Polls `/api/studio/slides?slug={slug}` every 5 seconds while generation is in progress
- Stops polling when all 6 slides are ready or after timeout (10 minutes)
- Updates in place — grid persists, only individual slots change

**Action buttons** below the grid:
- **Regenerate:** Dropdown to pick specific slide(s) or "All". Triggers `/api/studio/slides/regenerate`, resets affected slots to "generating" state.
- **Edit Texts:** Opens a modal with 6 text fields (one per slide), pre-filled from the manifest. Submit triggers regeneration with new texts.
- **Download:** Fetches all 6 slide URLs, zips client-side (or via API), downloads as `{slug}.zip`.

### `SlideLightbox`

Modal overlay triggered by clicking any ready slide in the grid. Shows the full 1024x1536 image. Navigation arrows to move between slides. Close on backdrop click or Escape.

## Data Flow

```
User types message
    ↓
useChat → POST /api/studio/chat
    ↓
API route → OpenClaw Gateway (SSE stream)
    ↓
Agent streams text response → chat panel updates
    ↓
Agent runs generate-photo-slides.js on Mac (30-90s per slide)
    ↓
Frontend detects manifest signal in stream
    ↓
PreviewPanel starts polling GET /api/studio/slides?slug=...
    ↓
API route SSHes to Mac → checks for slide_0N.png files
    ↓
New slide found → upload to storage → return CDN URL
    ↓
PreviewPanel updates grid slot with image
    ↓
All 6 ready → stop polling, enable action buttons
```

## Slide Detection Strategy

The agent's streamed text will include a manifest path when generation starts, in the format:
```
MANIFEST:~/clawd-oncourse/tiktok-marketing/posts/photo/{slug}/manifest.json
```

The frontend parses this from the stream to extract the slug and begin polling. If the agent doesn't output a clean manifest path (it might vary), we also support:
- Parsing the slug from phrases like "generating slides for concept: {slug}"
- A fallback: polling the most recent directory in `posts/photo/` on the Mac

## Error Handling

- **Gateway unreachable:** Show error banner in chat panel: "OpenClaw agent is offline. Check that the Mac is running."
- **SSH failure:** Slides API returns error. Preview panel shows "Unable to reach slide server" with retry button.
- **Partial generation failure:** Some slots stay in "generating" state. After 10-minute timeout, show "Generation timed out" with option to retry individual slides.
- **Storage upload failure:** Retry up to 3 times. If persistent, return the raw SSH-fetched image as a base64 data URL as fallback.

## Tech Stack

- **Framework:** Next.js 16 App Router
- **Chat:** Vercel AI SDK (`ai` package) — `useChat` hook + `streamText`
- **AI Provider:** `@ai-sdk/openai` pointed at OpenClaw gateway
- **UI:** shadcn/ui components, Tailwind CSS
- **SSH:** `ssh2` npm package for server-side SSH to Mac
- **Storage:** Supabase Storage
- **Image zip:** `jszip` for client-side download bundling

## Sidebar Navigation Update

Add "Studio" to the sidebar between the existing nav items:

```
Home
Accounts
Videos
Viral Hooks
Activity
─────────
Studio        ← new
─────────
Research
Import
Sync
Settings
```

Studio links to `/studio`. Active state highlights when on any `/studio/*` route.

## Future Extensibility

The Studio landing page + sub-route pattern supports adding new formats without structural changes:
- `/studio/ugc-hooks` — UGC hook production chat
- `/studio/videos` — Remotion video generation chat

Each format gets its own chat page with a format-specific preview panel (video player, hook preview, etc.). The chat infrastructure (gateway proxy, `useChat`) is shared.
