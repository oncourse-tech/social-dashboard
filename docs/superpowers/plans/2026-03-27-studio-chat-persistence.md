# Studio Chat Persistence & Parallel Generations — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add database-backed chat persistence and multi-chat support to Studio Slideshows, enabling users to run parallel slideshow generations and return to past conversations.

**Architecture:** Two new Prisma models (StudioChat, StudioMessage) store chat state. `/studio/slideshows` becomes a chat list page; `/studio/slideshows/[chatId]` holds the existing chat+preview UI. New CRUD API routes manage chats. The existing `/api/studio/chat` route is modified to persist messages alongside streaming.

**Tech Stack:** Prisma (PostgreSQL), Next.js App Router, Vercel AI SDK (`useChat`), shadcn/ui, Tailwind CSS.

**Spec:** `docs/superpowers/specs/2026-03-27-studio-chat-persistence-design.md`

---

## File Structure

```
prisma/
├── schema.prisma                              ← MODIFY: add StudioChat + StudioMessage models
│
src/
├── app/
│   ├── api/studio/
│   │   ├── chat/route.ts                      ← MODIFY: accept chatId, persist messages
│   │   └── chats/
│   │       ├── route.ts                       ← CREATE: GET (list) + POST (create)
│   │       └── [chatId]/route.ts              ← CREATE: GET + PATCH + DELETE
│   └── (dashboard)/studio/
│       ├── slideshows/
│       │   ├── page.tsx                       ← REWRITE: chat list page
│       │   └── [chatId]/page.tsx              ← CREATE: chat+preview (moved from slideshows/page.tsx)
├── components/studio/
│   ├── chat-panel.tsx                         ← MODIFY: add chatId prop, onFinish persistence
│   └── use-slide-polling.ts                   ← MODIFY: add initialState param
```

---

## Task 1: Prisma Schema — Add StudioChat and StudioMessage

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add models to schema.prisma**

Add at the end of `prisma/schema.prisma`:

```prisma
model StudioChat {
  id        String   @id @default(uuid())
  title     String   @default("New Slideshow")
  status    String   @default("active")
  slug      String?
  slides    Json?
  manifest  Json?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  messages  StudioMessage[]

  @@index([createdAt])
}

model StudioMessage {
  id        String   @id @default(uuid())
  chatId    String
  role      String
  content   String
  createdAt DateTime @default(now())
  chat      StudioChat @relation(fields: [chatId], references: [id], onDelete: Cascade)

  @@index([chatId, createdAt])
}
```

- [ ] **Step 2: Run migration**

```bash
cd /Users/shubh/workspace/oncourse/social-dashboard
npx prisma migrate dev --name add-studio-chat
```

Expected: Migration created, `prisma generate` runs automatically.

- [ ] **Step 3: Verify generation**

```bash
npx prisma generate
```

Expected: No errors. `@prisma/client` now includes `StudioChat` and `StudioMessage`.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(studio): add StudioChat and StudioMessage Prisma models"
```

---

## Task 2: Chat CRUD API Routes

**Files:**
- Create: `src/app/api/studio/chats/route.ts`
- Create: `src/app/api/studio/chats/[chatId]/route.ts`

- [ ] **Step 1: Create list + create route**

Create `src/app/api/studio/chats/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/studio/chats — list all chats
export async function GET() {
  const chats = await db.studioChat.findMany({
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      status: true,
      slug: true,
      slides: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  return NextResponse.json(chats);
}

// POST /api/studio/chats — create new chat
export async function POST() {
  const chat = await db.studioChat.create({
    data: {},
    select: { id: true },
  });
  return NextResponse.json(chat, { status: 201 });
}
```

- [ ] **Step 2: Create single-chat route (GET, PATCH, DELETE)**

Create `src/app/api/studio/chats/[chatId]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/studio/chats/[chatId] — get chat with messages
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  const { chatId } = await params;
  const chat = await db.studioChat.findUnique({
    where: { id: chatId },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!chat) {
    return NextResponse.json({ error: "Chat not found" }, { status: 404 });
  }

  return NextResponse.json(chat);
}

// PATCH /api/studio/chats/[chatId] — update chat fields
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  const { chatId } = await params;
  const body = await req.json();

  // Only allow updating specific fields
  const allowed = ["title", "status", "slug", "slides", "manifest"] as const;
  const data: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) data[key] = body[key];
  }

  const chat = await db.studioChat.update({
    where: { id: chatId },
    data,
  });

  return NextResponse.json(chat);
}

// DELETE /api/studio/chats/[chatId] — delete chat + messages (cascade)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  const { chatId } = await params;
  await db.studioChat.delete({ where: { id: chatId } });
  return new NextResponse(null, { status: 204 });
}
```

- [ ] **Step 3: Verify routes compile**

```bash
cd /Users/shubh/workspace/oncourse/social-dashboard
npx next build --no-lint 2>&1 | head -40
```

Expected: No TypeScript errors for the new routes.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/studio/chats/
git commit -m "feat(studio): add chat CRUD API routes"
```

---

## Task 3: Modify Chat Streaming Route to Persist Messages

**Files:**
- Modify: `src/app/api/studio/chat/route.ts`

- [ ] **Step 1: Update the POST handler to accept chatId and persist messages**

Replace the contents of `src/app/api/studio/chat/route.ts`:

```typescript
import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  type UIMessage,
} from "ai";
import { db } from "@/lib/db";

export const maxDuration = 300;

const SYSTEM_PROMPT = `You are a slideshow production assistant. Use the tiktok-brain skill to generate photorealistic slideshows.

Follow the production-slides workflow from the tiktok-brain skill:
1. Write 6 slide texts (Hook → Problem → Discovery → Reveal → Result → CTA)
2. Run generate-photo-slides.js at ~/clawd-oncourse/tiktok-marketing/scripts/generate-photo-slides.js
3. Use flags: --concept, --texts, --scene, --account @oncourse.usmle, --cta

After generate-photo-slides.js completes, ALWAYS run the upload script:
  node ~/clawd-oncourse/tiktok-marketing/scripts/upload-slides-to-supabase.js --manifest ~/clawd-oncourse/tiktok-marketing/posts/photo/{slug}/manifest.json

The upload script outputs JSON with Supabase CDN URLs for each slide. Include the full JSON output in your response so the UI can display the slides. Format it as a code block tagged SLIDE_URLS:
\`\`\`SLIDE_URLS
{the JSON output from the upload script}
\`\`\``;

function extractText(msg: UIMessage): string {
  return (
    msg.parts
      ?.filter((p): p is { type: "text"; text: string } => p.type === "text")
      .map((p) => p.text)
      .join("") ?? ""
  );
}

export async function POST(req: Request) {
  const { messages, chatId }: { messages: UIMessage[]; chatId?: string } =
    await req.json();

  // Persist the latest user message if chatId is provided
  if (chatId && messages.length > 0) {
    const lastMsg = messages[messages.length - 1];
    if (lastMsg.role === "user") {
      await db.studioMessage.create({
        data: {
          chatId,
          role: "user",
          content: extractText(lastMsg),
        },
      });
      await db.studioChat.update({
        where: { id: chatId },
        data: { updatedAt: new Date() },
      });
    }
  }

  const input = messages.map((msg) => ({
    type: "message" as const,
    role: msg.role,
    content: extractText(msg),
  }));

  let fullResponse = "";

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      const response = await fetch(
        `${process.env.OPENCLAW_GATEWAY_URL}/v1/responses`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.OPENCLAW_GATEWAY_TOKEN}`,
          },
          body: JSON.stringify({
            model: "openclaw",
            instructions: SYSTEM_PROMPT,
            input,
            stream: true,
          }),
        }
      );

      writer.write({ type: "start" });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Gateway error (${response.status}): ${text}`);
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      const textId = `txt_${Date.now()}`;
      let textStarted = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") continue;

          try {
            const parsed = JSON.parse(data);

            if (parsed.type === "response.output_text.delta" && parsed.delta) {
              if (!textStarted) {
                writer.write({ type: "text-start", id: textId });
                textStarted = true;
              }
              writer.write({
                type: "text-delta",
                id: textId,
                delta: parsed.delta,
              });
              fullResponse += parsed.delta;
            }

            if (parsed.choices?.[0]?.delta?.content) {
              if (!textStarted) {
                writer.write({ type: "text-start", id: textId });
                textStarted = true;
              }
              writer.write({
                type: "text-delta",
                id: textId,
                delta: parsed.choices[0].delta.content,
              });
              fullResponse += parsed.choices[0].delta.content;
            }
          } catch {
            // Skip unparseable
          }
        }
      }

      if (textStarted) {
        writer.write({ type: "text-end", id: textId });
      }
      writer.write({ type: "finish", finishReason: "stop" });

      // Persist the assistant response after stream completes
      if (chatId && fullResponse) {
        await db.studioMessage.create({
          data: {
            chatId,
            role: "assistant",
            content: fullResponse,
          },
        });

        // Auto-title: set title from first user message if still default
        const chat = await db.studioChat.findUnique({
          where: { id: chatId },
          select: { title: true },
        });
        if (chat?.title === "New Slideshow" && messages.length > 0) {
          const firstUserMsg = messages.find((m) => m.role === "user");
          if (firstUserMsg) {
            const title = extractText(firstUserMsg).slice(0, 50).trim() || "New Slideshow";
            await db.studioChat.update({
              where: { id: chatId },
              data: { title },
            });
          }
        }
      }
    },
    onError: (error) => {
      return error instanceof Error ? error.message : String(error);
    },
  });

  return createUIMessageStreamResponse({
    stream,
    headers: {
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/studio/chat/route.ts
git commit -m "feat(studio): persist messages in chat streaming route"
```

---

## Task 4: Update useSlidePolling to Accept Initial State

**Files:**
- Modify: `src/components/studio/use-slide-polling.ts`

- [ ] **Step 1: Add initialState parameter**

In `src/components/studio/use-slide-polling.ts`, change the hook signature and initial state:

Replace the current `useSlidePolling` function declaration and the `useState` call:

```typescript
// Old:
export function useSlidePolling() {
  const [state, setState] = useState<SlideshowState>({
    slug: null,
    status: "idle",
    slides: EMPTY_SLIDES,
    manifest: null,
    error: null,
  });
```

With:

```typescript
export interface UseSlidePollingOptions {
  initialSlug?: string | null;
  initialSlides?: SlideState[];
  initialManifest?: Record<string, unknown> | null;
}

export function useSlidePolling(options?: UseSlidePollingOptions) {
  const hasInitial = options?.initialSlug && options?.initialSlides?.some(s => s.status === "ready");
  const [state, setState] = useState<SlideshowState>({
    slug: options?.initialSlug ?? null,
    status: hasInitial
      ? (options!.initialSlides!.every(s => s.status === "ready") ? "complete" : "generating")
      : "idle",
    slides: options?.initialSlides ?? EMPTY_SLIDES,
    manifest: options?.initialManifest ?? null,
    error: null,
  });
```

Then add an effect after the existing `useEffect(() => stopPolling, [stopPolling])` to auto-resume polling if slides are incomplete:

```typescript
  // Auto-resume polling if initialized with incomplete slides
  useEffect(() => {
    if (
      options?.initialSlug &&
      options?.initialSlides?.some(s => s.status === "ready") &&
      !options?.initialSlides?.every(s => s.status === "ready")
    ) {
      startPolling(options.initialSlug);
    }
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
```

- [ ] **Step 2: Commit**

```bash
git add src/components/studio/use-slide-polling.ts
git commit -m "feat(studio): add initialState support to useSlidePolling"
```

---

## Task 5: Update ChatPanel to Support chatId and Persistence

**Files:**
- Modify: `src/components/studio/chat-panel.tsx`

- [ ] **Step 1: Add chatId prop and pass it to the API**

In `src/components/studio/chat-panel.tsx`, update the props interface:

```typescript
interface ChatPanelProps {
  chatId: string;
  initialMessages?: Array<{ id: string; role: "user" | "assistant"; content: string }>;
  onSlugDetected: (slug: string) => void;
  onSlideUrlsDetected?: (data: SlideUrlData) => void;
  appendRef?: React.MutableRefObject<((message: string) => void) | null>;
}
```

- [ ] **Step 2: Update useChat to include chatId and initialMessages**

Replace the transport and `useChat` setup:

```typescript
export function ChatPanel({ chatId, initialMessages, onSlugDetected, onSlideUrlsDetected, appendRef }: ChatPanelProps) {
  const transport = useMemo(
    () => new DefaultChatTransport({ api: "/api/studio/chat" }),
    []
  );

  // Convert DB messages to UIMessage format for useChat
  const hydrated = useMemo(() => {
    if (!initialMessages?.length) return undefined;
    return initialMessages.map((m) => ({
      id: m.id,
      role: m.role as "user" | "assistant",
      parts: [{ type: "text" as const, text: m.content }],
      createdAt: new Date(),
    }));
  }, [initialMessages]);

  const { messages, sendMessage, status } = useChat({
    transport,
    initialMessages: hydrated,
    body: { chatId },
  });
```

Add the `useMemo` import at the top:

```typescript
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useState, useEffect, useRef, useMemo } from "react";
```

Move the `transport` constant out of module scope (it's now inside the component with `useMemo`). Remove the old module-level `const transport = ...`.

- [ ] **Step 3: Add onFinish callback to persist slide state**

Add an `onSlideStateChange` prop and call it when slide URLs are detected. Update the props:

```typescript
interface ChatPanelProps {
  chatId: string;
  initialMessages?: Array<{ id: string; role: "user" | "assistant"; content: string }>;
  onSlugDetected: (slug: string) => void;
  onSlideUrlsDetected?: (data: SlideUrlData) => void;
  onSlideStateChange?: (slug: string, slides: SlideUrlData) => void;
  appendRef?: React.MutableRefObject<((message: string) => void) | null>;
}
```

In the existing `useEffect` that detects slide URLs, add a call after `onSlideUrlsDetected`:

```typescript
if (data.slug && data.slides && !detectedSlugs.current.has("urls:" + data.slug)) {
  detectedSlugs.current.add("urls:" + data.slug);
  onSlideUrlsDetected?.(data);
  onSlideStateChange?.(data.slug, data);
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/studio/chat-panel.tsx
git commit -m "feat(studio): add chatId, initialMessages, and persistence callbacks to ChatPanel"
```

---

## Task 6: Create Chat Detail Page (move existing page logic)

**Files:**
- Create: `src/app/(dashboard)/studio/slideshows/[chatId]/page.tsx`

- [ ] **Step 1: Create the [chatId] page**

Create `src/app/(dashboard)/studio/slideshows/[chatId]/page.tsx`:

```typescript
"use client";

import { useState, useCallback, useRef, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare, Grid2x2, ArrowLeft } from "lucide-react";
import { ChatPanel, type SlideUrlData } from "@/components/studio/chat-panel";
import { PreviewPanel } from "@/components/studio/preview-panel";
import { SlideLightbox } from "@/components/studio/slide-lightbox";
import { EditTextsDialog } from "@/components/studio/edit-texts-dialog";
import { FeedbackDialog } from "@/components/studio/feedback-dialog";
import { useSlidePolling, type SlideState } from "@/components/studio/use-slide-polling";
import { cn } from "@/lib/utils";
import JSZip from "jszip";

interface ChatData {
  id: string;
  title: string;
  status: string;
  slug: string | null;
  slides: SlideUrlData["slides"] | null;
  manifest: Record<string, unknown> | null;
  messages: Array<{ id: string; role: "user" | "assistant"; content: string }>;
}

export default function SlideshowChatPage({
  params,
}: {
  params: Promise<{ chatId: string }>;
}) {
  const { chatId } = use(params);
  const router = useRouter();
  const [chatData, setChatData] = useState<ChatData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/studio/chats/${chatId}`)
      .then((res) => {
        if (!res.ok) throw new Error("Chat not found");
        return res.json();
      })
      .then((data) => setChatData(data))
      .catch((err) => setError(String(err)))
      .finally(() => setLoading(false));
  }, [chatId]);

  if (loading) {
    return (
      <div className="-m-4 md:-m-6 flex items-center justify-center h-[calc(100vh-3.5rem)] md:h-screen">
        <div className="text-sm text-muted-foreground">Loading chat...</div>
      </div>
    );
  }

  if (error || !chatData) {
    return (
      <div className="-m-4 md:-m-6 flex flex-col items-center justify-center gap-3 h-[calc(100vh-3.5rem)] md:h-screen">
        <p className="text-sm text-destructive">{error || "Chat not found"}</p>
        <button
          onClick={() => router.push("/studio/slideshows")}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Back to chats
        </button>
      </div>
    );
  }

  return <ChatDetailInner chatData={chatData} />;
}

function ChatDetailInner({ chatData }: { chatData: ChatData }) {
  const router = useRouter();
  const initialSlides = chatData.slides?.map((s) => ({
    index: s.index,
    url: s.url,
    status: s.status as SlideState["status"],
  }));

  const slideState = useSlidePolling({
    initialSlug: chatData.slug,
    initialSlides,
    initialManifest: chatData.manifest,
  });

  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [editTextsOpen, setEditTextsOpen] = useState(false);
  const [regenOpen, setRegenOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<"chat" | "preview">("chat");
  const appendRef = useRef<((message: string) => void) | null>(null);

  const sendChatMessage = useCallback((text: string) => {
    appendRef.current?.(text);
  }, []);

  const handleSlugDetected = useCallback(
    (slug: string) => {
      slideState.startPolling(slug);
      // Persist slug to chat
      fetch(`/api/studio/chats/${chatData.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });
    },
    [slideState.startPolling, chatData.id]
  );

  const handleSlideUrlsDetected = useCallback(
    (data: SlideUrlData) => {
      const busted = {
        ...data,
        slides: data.slides.map((s) => ({
          ...s,
          url: s.url ? `${s.url}?t=${Date.now()}` : null,
        })),
      };
      slideState.setSlidesFromUrls(busted);
      setMobileTab("preview");

      // Persist slide state to chat
      fetch(`/api/studio/chats/${chatData.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: data.slug,
          slides: data.slides,
          status: data.slides.every((s) => s.status === "ready") ? "complete" : "active",
        }),
      });
    },
    [slideState.setSlidesFromUrls, chatData.id]
  );

  const handleRegenerate = useCallback(
    (feedback: string) => {
      setRegenOpen(false);
      const msg = feedback.trim()
        ? `Regenerate the slideshow with this feedback: ${feedback}`
        : "Regenerate all 6 slides for the current slideshow with fresh images.";
      sendChatMessage(msg);
      slideState.reset();
      setMobileTab("chat");
    },
    [sendChatMessage, slideState.reset]
  );

  const handleEditTextsSubmit = useCallback(
    (texts: string[], feedback: string) => {
      setEditTextsOpen(false);
      const textsFormatted = texts
        .map((t, i) => `Slide ${i + 1}: "${t}"`)
        .join("\n");
      const feedbackPart = feedback.trim()
        ? `\n\nAdditional feedback: ${feedback}`
        : "";
      sendChatMessage(
        `Regenerate the slideshow with these updated texts:\n${textsFormatted}${feedbackPart}`
      );
      slideState.reset();
      setMobileTab("chat");
    },
    [sendChatMessage, slideState.reset]
  );

  const handleDownload = useCallback(async () => {
    const readySlides = slideState.slides.filter(
      (s) => s.status === "ready" && s.url
    );
    if (readySlides.length === 0) return;

    const zip = new JSZip();
    await Promise.all(
      readySlides.map(async (slide) => {
        const res = await fetch(slide.url!);
        const blob = await res.blob();
        zip.file(
          `slide_${String(slide.index).padStart(2, "0")}.png`,
          blob
        );
      })
    );

    const content = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(content);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slideState.slug || "slideshow"}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  }, [slideState.slides, slideState.slug]);

  const currentTexts =
    (slideState.manifest as { texts?: string[] })?.texts ?? Array(6).fill("");

  const readyCount = slideState.slides.filter(
    (s) => s.status === "ready"
  ).length;

  return (
    <div className="-m-4 md:-m-6 flex flex-col md:flex-row h-[calc(100vh-3.5rem)] md:h-screen">
      {/* Chat panel */}
      <div
        className={cn(
          "md:w-[55%] md:min-w-[360px] md:border-r md:border-border/50",
          "flex-1 min-h-0 md:flex-none",
          mobileTab === "chat" ? "flex flex-col" : "hidden md:flex md:flex-col"
        )}
      >
        <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border/50 px-3">
          <button
            onClick={() => router.push("/studio/slideshows")}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-3.5" />
            Chats
          </button>
          <span className="text-xs text-border/80">|</span>
          <span className="text-xs font-medium text-foreground/70 truncate">
            {chatData.title}
          </span>
        </div>
        <ChatPanel
          chatId={chatData.id}
          initialMessages={chatData.messages}
          onSlugDetected={handleSlugDetected}
          onSlideUrlsDetected={handleSlideUrlsDetected}
          appendRef={appendRef}
        />
      </div>

      {/* Preview panel */}
      <div
        className={cn(
          "md:w-[45%] md:min-w-[300px]",
          "flex-1 min-h-0 md:flex-none",
          mobileTab === "preview"
            ? "flex flex-col"
            : "hidden md:flex md:flex-col"
        )}
      >
        <PreviewPanel
          state={slideState}
          onSlideClick={setLightboxIndex}
          onRegenerate={() => setRegenOpen(true)}
          onEditTexts={() => setEditTextsOpen(true)}
          onDownload={handleDownload}
        />
      </div>

      {/* Mobile tab bar */}
      <div className="md:hidden shrink-0 flex border-t border-border/50 bg-background">
        <button
          onClick={() => setMobileTab("chat")}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-3 text-xs font-medium transition-colors",
            mobileTab === "chat"
              ? "text-indigo-400 border-t-2 border-indigo-400 -mt-px"
              : "text-muted-foreground"
          )}
        >
          <MessageSquare className="size-4" />
          Chat
        </button>
        <button
          onClick={() => setMobileTab("preview")}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-3 text-xs font-medium transition-colors relative",
            mobileTab === "preview"
              ? "text-indigo-400 border-t-2 border-indigo-400 -mt-px"
              : "text-muted-foreground"
          )}
        >
          <Grid2x2 className="size-4" />
          Preview
          {readyCount > 0 && (
            <span className="absolute top-2 right-[calc(50%-28px)] size-4 flex items-center justify-center rounded-full bg-indigo-500 text-[9px] font-bold text-white">
              {readyCount}
            </span>
          )}
        </button>
      </div>

      {/* Modals */}
      <SlideLightbox
        slides={slideState.slides}
        activeIndex={lightboxIndex}
        onClose={() => setLightboxIndex(null)}
        onNavigate={setLightboxIndex}
      />

      <FeedbackDialog
        open={regenOpen}
        onOpenChange={setRegenOpen}
        title="Regenerate Slideshow"
        description="Optionally describe what to change. Leave empty to regenerate with the same concept."
        submitLabel="Regenerate"
        onSubmit={handleRegenerate}
      />

      <EditTextsDialog
        open={editTextsOpen}
        onOpenChange={setEditTextsOpen}
        initialTexts={currentTexts}
        onSubmit={handleEditTextsSubmit}
      />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(dashboard\)/studio/slideshows/\[chatId\]/page.tsx
git commit -m "feat(studio): create chat detail page at /studio/slideshows/[chatId]"
```

---

## Task 7: Rewrite Chat List Page

**Files:**
- Modify: `src/app/(dashboard)/studio/slideshows/page.tsx`

- [ ] **Step 1: Replace with chat list UI**

Replace the entire contents of `src/app/(dashboard)/studio/slideshows/page.tsx`:

```typescript
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, Sparkles, Trash2, Loader2, Clock, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

interface ChatSummary {
  id: string;
  title: string;
  status: string;
  slug: string | null;
  slides: Array<{ index: number; url: string | null; status: string }> | null;
  createdAt: string;
  updatedAt: string;
}

export default function SlideshowsListPage() {
  const router = useRouter();
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetch("/api/studio/chats")
      .then((res) => res.json())
      .then(setChats)
      .finally(() => setLoading(false));
  }, []);

  const createChat = async () => {
    setCreating(true);
    try {
      const res = await fetch("/api/studio/chats", { method: "POST" });
      const { id } = await res.json();
      router.push(`/studio/slideshows/${id}`);
    } finally {
      setCreating(false);
    }
  };

  const deleteChat = async (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setChats((prev) => prev.filter((c) => c.id !== chatId));
    await fetch(`/api/studio/chats/${chatId}`, { method: "DELETE" });
  };

  const getStatusIcon = (chat: ChatSummary) => {
    if (chat.status === "complete") {
      return <CheckCircle2 className="size-3.5 text-emerald-400" />;
    }
    if (chat.status === "active" && chat.slug) {
      return <Loader2 className="size-3.5 animate-spin text-indigo-400" />;
    }
    return <Clock className="size-3.5 text-muted-foreground/40" />;
  };

  const getPreviewThumbnail = (chat: ChatSummary) => {
    const readySlide = chat.slides?.find((s) => s.status === "ready" && s.url);
    return readySlide?.url ?? null;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Slideshows</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your slideshow generation chats
          </p>
        </div>
        <button
          onClick={createChat}
          disabled={creating}
          className={cn(
            "flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-all",
            "bg-indigo-500 text-white hover:bg-indigo-600 shadow-sm shadow-indigo-500/25",
            creating && "opacity-50 cursor-not-allowed"
          )}
        >
          {creating ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Plus className="size-4" />
          )}
          New Slideshow
        </button>
      </div>

      {chats.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500/20 to-violet-500/20 ring-1 ring-indigo-500/10">
            <Sparkles className="size-5 text-indigo-400" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-foreground/80">No slideshows yet</p>
            <p className="mt-1 text-xs text-muted-foreground max-w-[280px]">
              Create your first slideshow to get started
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {chats.map((chat) => {
            const thumb = getPreviewThumbnail(chat);

            return (
              <button
                key={chat.id}
                onClick={() => router.push(`/studio/slideshows/${chat.id}`)}
                className="group w-full flex items-center gap-3 rounded-xl border border-border/60 p-3 transition-all hover:border-border hover:bg-muted/30 text-left"
              >
                {/* Thumbnail or placeholder */}
                <div className="size-12 shrink-0 rounded-lg overflow-hidden bg-muted/50 ring-1 ring-white/[0.06]">
                  {thumb ? (
                    <img src={thumb} alt="" className="size-full object-cover" />
                  ) : (
                    <div className="size-full flex items-center justify-center">
                      <Sparkles className="size-4 text-muted-foreground/30" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(chat)}
                    <span className="text-sm font-medium truncate">
                      {chat.title}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(chat.updatedAt), { addSuffix: true })}
                  </p>
                </div>

                {/* Delete */}
                <button
                  onClick={(e) => deleteChat(chat.id, e)}
                  className="shrink-0 p-1.5 rounded-md text-muted-foreground/30 opacity-0 group-hover:opacity-100 hover:text-destructive hover:bg-destructive/10 transition-all"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(dashboard\)/studio/slideshows/page.tsx
git commit -m "feat(studio): rewrite slideshows page as chat list"
```

---

## Task 8: Verify Build and End-to-End Smoke Test

**Files:** None (verification only)

- [ ] **Step 1: Run build to check for TypeScript errors**

```bash
cd /Users/shubh/workspace/oncourse/social-dashboard
pnpm build 2>&1 | tail -20
```

Expected: Build succeeds with no TypeScript errors.

- [ ] **Step 2: Start dev server and smoke test**

```bash
pnpm dev
```

Manual checks:
1. Navigate to `/studio/slideshows` — see empty chat list with "New Slideshow" button
2. Click "New Slideshow" — redirects to `/studio/slideshows/[chatId]`
3. See back button "Chats" in header, chat title shows "New Slideshow"
4. Type a message and send — message persists (check DB or refresh page)
5. Navigate back to `/studio/slideshows` — chat appears in list with auto-title
6. Click the chat — messages are restored, preview grid shows saved state
7. Start a second chat while first is still generating — both exist independently
8. Delete a chat from the list — disappears

- [ ] **Step 3: Fix any issues found during smoke test**

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "fix(studio): address build/smoke-test issues"
```

(Only if there were fixes needed.)
