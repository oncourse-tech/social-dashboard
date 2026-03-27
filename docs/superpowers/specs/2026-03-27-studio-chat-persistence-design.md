# Studio Chat Persistence & Parallel Generations — Design Spec

**Date:** 2026-03-27
**Status:** Approved

## Overview

Add persistence and multi-chat support to the Studio Slideshows feature. Currently, chat history is entirely in-memory — navigating away loses everything, and only one generation can happen at a time. This spec adds database-backed chat storage and a chat list UI, enabling users to run multiple slideshow generations in parallel and return to any conversation later.

## Decisions

- **Multiple independent chat threads** (not queued within one chat)
- **Database persistence** via Prisma/PostgreSQL (not localStorage)
- **Chat list as landing page** at `/studio/slideshows`, detail at `/studio/slideshows/[chatId]`
- **Per-chat status only** — no global generation indicator
- **Full replacement** of current single-chat page (no "quick mode")
- **Minimal schema** — Chat + Messages only, slide state as JSON on chat record

## Database Schema

Two new models in `prisma/schema.prisma`:

```prisma
model StudioChat {
  id        String   @id @default(uuid())
  title     String   @default("New Slideshow")
  status    String   @default("active")  // "active" | "complete" | "error"
  slug      String?                       // current slideshow slug
  slides    Json?                         // slide URLs/status array (SlideUrlData shape)
  manifest  Json?                         // manifest from generation
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  messages  StudioMessage[]

  @@index([createdAt])
}

model StudioMessage {
  id        String   @id @default(uuid())
  chatId    String
  role      String                        // "user" | "assistant"
  content   String
  createdAt DateTime @default(now())
  chat      StudioChat @relation(fields: [chatId], references: [id], onDelete: Cascade)

  @@index([chatId, createdAt])
}
```

Key decisions:
- `slides` as JSON — stores the same `SlideUrlData` shape the frontend already uses
- `status` as string (not enum) — flexible without migrations for new states
- `slug` on chat record — enables reconnecting slide polling on revisit
- Cascade delete — removing a chat removes its messages

## Route Structure

### Pages

| Route | Purpose |
|-------|---------|
| `/studio/slideshows` | Chat list (replaces current single-chat page) |
| `/studio/slideshows/[chatId]` | Chat + Preview (current page logic moves here) |

### API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/studio/chats` | GET | List all chats (ordered by updatedAt desc) |
| `/api/studio/chats` | POST | Create new chat, return `{ id }` |
| `/api/studio/chats/[chatId]` | GET | Get chat with messages |
| `/api/studio/chats/[chatId]` | PATCH | Update title, slides, slug, status |
| `/api/studio/chats/[chatId]` | DELETE | Delete chat + messages |
| `/api/studio/chat` | POST | **Existing** — modified to accept `chatId`, saves messages to DB before/after streaming |

## Frontend Flow

### Chat List Page (`/studio/slideshows/page.tsx`)

- Fetches `GET /api/studio/chats` on load
- Displays cards: title, relative timestamp, status badge (generating spinner / complete checkmark)
- "New Slideshow" button → `POST /api/studio/chats` → redirect to `/studio/slideshows/[chatId]`
- Click existing chat → navigate to `/studio/slideshows/[chatId]`
- Delete action available per chat

### Chat Detail Page (`/studio/slideshows/[chatId]/page.tsx`)

- Fetches `GET /api/studio/chats/[chatId]` on load → messages + slide state
- Passes `initialMessages` to `useChat` for immediate history rendering
- Passes saved `slides`/`slug` to `useSlidePolling` to restore preview grid
- If `status === "active"` and `slug` exists but slides incomplete → resumes polling
- All existing components (ChatPanel, PreviewPanel, SlideLightbox, EditTextsDialog, FeedbackDialog) reused unchanged

### Message Persistence

- User message saved in `/api/studio/chat` route before proxying to OpenClaw
- `useChat`'s `onFinish` → save assistant message + update slide state via `PATCH /api/studio/chats/[chatId]`
- Streaming UX stays identical — persistence happens in background

### Auto-Title

After first assistant response, derive title from user's first message (truncated to ~50 chars). Update via PATCH.

## Data Flow

```
User clicks "New Slideshow"
    → POST /api/studio/chats → returns { id }
    → redirect to /studio/slideshows/[chatId]

User types message
    → POST /api/studio/chat { chatId, messages }
    → API saves user message to StudioMessage
    → proxies to OpenClaw gateway (SSE stream)
    → ChatPanel renders streaming response
    → stream completes → API saves assistant message to StudioMessage
    → ChatPanel's onFinish → PATCH chat with slide URLs/slug if detected

User navigates away mid-generation
    → slides/slug already saved on chat record
    → generation continues on remote Mac regardless

User returns to chat later
    → GET /api/studio/chats/[chatId] → messages + slides + slug
    → useChat hydrated with initialMessages
    → useSlidePolling initialized with saved slides
    → if slug exists & slides incomplete → resumes polling
    → if all slides ready → preview grid renders immediately

User goes back to chat list
    → GET /api/studio/chats → sees all chats with timestamps
    → can open any chat or start a new one
```

Key insight: generation is decoupled from the browser session. The Mac keeps working, slides get uploaded to Supabase CDN. When revisiting, the saved slide state or resumed polling picks up wherever it left off.

## Component Changes Summary

| Component | Change |
|-----------|--------|
| `chat-panel.tsx` | Add `chatId` prop, `onFinish` callback for persistence |
| `preview-panel.tsx` | No changes |
| `use-slide-polling.ts` | Add `initialState` param for hydration on revisit |
| `slide-lightbox.tsx` | No changes |
| `edit-texts-dialog.tsx` | No changes |
| `feedback-dialog.tsx` | No changes |
| `slideshows/page.tsx` | Replace with chat list UI |
| `slideshows/[chatId]/page.tsx` | New — current page logic moves here |

## Error Handling

- **Chat load failure:** Show error state on list/detail page with retry
- **Message save failure:** Non-blocking — log error, chat continues (messages may be lost on that exchange)
- **Resumed polling finds no slides:** Show stale state from saved JSON, polling will update when slides appear
- **Deleted chat while generating:** Generation continues on Mac but results are orphaned (acceptable)
