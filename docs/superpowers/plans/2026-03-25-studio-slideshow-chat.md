# Studio Slideshow Chat UI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Studio section with a chat-based slideshow generator that streams responses from the OpenClaw agent and progressively displays generated slides in a 2x3 preview grid.

**Architecture:** Next.js API route proxies chat to OpenClaw gateway (OpenAI-compatible) via Vercel AI SDK. A separate API route SSHes to the Mac to poll for generated slide PNGs, uploads them to Supabase Storage, and returns CDN URLs. Frontend uses `useChat` for streaming chat and polls for slide status.

**Tech Stack:** Next.js 16 App Router, Vercel AI SDK (`ai` + `@ai-sdk/openai`), `ssh2` for server-side SSH, Supabase Storage, shadcn/ui, Tailwind CSS, `jszip` for download.

**Spec:** `docs/superpowers/specs/2026-03-25-studio-slideshow-chat-design.md`

---

## File Structure

```
src/
├── lib/
│   ├── constants.ts                    ← MODIFY: add Studio nav section
│   ├── ssh.ts                          ← CREATE: SSH client helper (connect, exec, readFile)
│   └── storage.ts                      ← CREATE: Supabase Storage upload helper
├── components/
│   ├── sidebar.tsx                     ← MODIFY: add Clapperboard icon to ICON_MAP
│   └── studio/
│       ├── chat-panel.tsx              ← CREATE: chat UI with useChat + appendRef for programmatic messages
│       ├── preview-panel.tsx           ← CREATE: 2x3 slide grid + action buttons
│       ├── slide-lightbox.tsx          ← CREATE: fullscreen slide modal
│       ├── edit-texts-dialog.tsx       ← CREATE: modal to edit 6 slide texts
│       └── use-slide-polling.ts        ← CREATE: hook to poll slide status
├── app/
│   ├── (dashboard)/
│   │   └── studio/
│   │       ├── page.tsx                ← CREATE: studio landing with format cards
│   │       └── slideshows/
│   │           └── page.tsx            ← CREATE: split panel chat + preview
│   └── api/
│       └── studio/
│           ├── chat/
│           │   └── route.ts            ← CREATE: proxy to OpenClaw gateway
│           └── slides/
│               └── route.ts            ← CREATE: poll + fetch + upload slides
```

---

### Task 1: Install dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install required packages**

```bash
cd /Users/shubh/workspace/oncourse/social-dashboard
pnpm add @ai-sdk/openai ssh2 jszip @supabase/supabase-js
pnpm add -D @types/ssh2
```

- [ ] **Step 2: Verify installation**

Run: `pnpm build`
Expected: Builds successfully (no new errors introduced)

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "feat(studio): add deps for slideshow chat — ai-sdk/openai, ssh2, jszip, supabase"
```

---

### Task 2: SSH and Storage helpers

**Files:**
- Create: `src/lib/ssh.ts`
- Create: `src/lib/storage.ts`

- [ ] **Step 1: Create SSH helper**

Create `src/lib/ssh.ts`:

```typescript
import { Client } from "ssh2";

const SSH_CONFIG = {
  host: process.env.OPENCLAW_SSH_HOST!,
  username: process.env.OPENCLAW_SSH_USER!,
  privateKey: Buffer.from(process.env.OPENCLAW_SSH_PRIVATE_KEY!, "base64"),
};

export async function sshExec(command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    conn
      .on("ready", () => {
        conn.exec(command, (err, stream) => {
          if (err) { conn.end(); return reject(err); }
          let stdout = "";
          let stderr = "";
          stream.on("data", (data: Buffer) => { stdout += data.toString(); });
          stream.stderr.on("data", (data: Buffer) => { stderr += data.toString(); });
          stream.on("close", () => {
            conn.end();
            if (stderr && !stdout) reject(new Error(stderr));
            else resolve(stdout);
          });
        });
      })
      .on("error", reject)
      .connect(SSH_CONFIG);
  });
}

export async function sshReadFile(remotePath: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    conn
      .on("ready", () => {
        conn.sftp((err, sftp) => {
          if (err) { conn.end(); return reject(err); }
          sftp.readFile(remotePath, (err, buf) => {
            conn.end();
            if (err) reject(err);
            else resolve(buf);
          });
        });
      })
      .on("error", reject)
      .connect(SSH_CONFIG);
  });
}

export async function sshFileExists(remotePath: string): Promise<boolean> {
  try {
    await sshExec(`test -f ${remotePath} && echo exists`);
    return true;
  } catch {
    return false;
  }
}
```

- [ ] **Step 2: Create Storage helper**

Create `src/lib/storage.ts`:

```typescript
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BUCKET = process.env.STORAGE_BUCKET || "slides";

export async function uploadSlide(
  slug: string,
  slideNum: string,
  buffer: Buffer
): Promise<string> {
  const path = `studio/slideshows/${slug}/slide_${slideNum}.png`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, {
      contentType: "image/png",
      upsert: true,
    });

  if (error) throw new Error(`Upload failed: ${error.message}`);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
```

- [ ] **Step 3: Verify build**

Run: `pnpm build`
Expected: Builds successfully

- [ ] **Step 4: Commit**

```bash
git add src/lib/ssh.ts src/lib/storage.ts
git commit -m "feat(studio): add SSH and Supabase Storage helpers"
```

---

### Task 3: Chat API route

**Files:**
- Create: `src/app/api/studio/chat/route.ts`

- [ ] **Step 1: Create the chat proxy route**

Create `src/app/api/studio/chat/route.ts`:

```typescript
import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";

const openclaw = createOpenAI({
  baseURL: process.env.OPENCLAW_GATEWAY_URL + "/v1",
  apiKey: process.env.OPENCLAW_GATEWAY_TOKEN,
});

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: openclaw("openclaw:main"),
    messages,
  });

  return result.toDataStreamResponse();
}
```

- [ ] **Step 2: Verify build**

Run: `pnpm build`
Expected: Builds successfully

- [ ] **Step 3: Commit**

```bash
git add src/app/api/studio/chat/route.ts
git commit -m "feat(studio): add chat API route proxying to OpenClaw gateway"
```

---

### Task 4: Slides API route

**Files:**
- Create: `src/app/api/studio/slides/route.ts`

- [ ] **Step 1: Create the slides polling route**

Create `src/app/api/studio/slides/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { sshExec, sshReadFile, sshFileExists } from "@/lib/ssh";
import { uploadSlide } from "@/lib/storage";

const SLIDES_BASE = "~/clawd-oncourse/tiktok-marketing/posts/photo";

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug");
  if (!slug) {
    return NextResponse.json({ error: "slug is required" }, { status: 400 });
  }

  const dir = `${SLIDES_BASE}/${slug}`;

  try {
    // Check which slide files exist on the Mac
    const lsOutput = await sshExec(
      `ls ${dir}/slide_*.png 2>/dev/null || echo ""`
    ).catch(() => "");

    const existingFiles = lsOutput
      .trim()
      .split("\n")
      .filter((f) => f.endsWith(".png") && !f.includes(".raw."));

    // Check for manifest
    const manifestPath = `${dir}/manifest.json`;
    const hasManifest = await sshFileExists(manifestPath);
    let manifest = null;
    if (hasManifest) {
      const manifestBuf = await sshReadFile(manifestPath);
      manifest = JSON.parse(manifestBuf.toString());
    }

    // Build slide status array
    const slides = await Promise.all(
      Array.from({ length: 6 }, async (_, i) => {
        const num = String(i + 1).padStart(2, "0");
        const remotePath = `${dir}/slide_${num}.png`;
        const exists = existingFiles.some((f) => f.includes(`slide_${num}.png`));

        if (!exists) {
          return {
            index: i + 1,
            url: null,
            status: hasManifest ? "failed" : "pending" as const,
          };
        }

        // Upload to storage and get CDN URL
        try {
          const buffer = await sshReadFile(remotePath);
          const url = await uploadSlide(slug, num, buffer);
          return { index: i + 1, url, status: "ready" as const };
        } catch {
          return { index: i + 1, url: null, status: "generating" as const };
        }
      })
    );

    const allReady = slides.every((s) => s.status === "ready");

    return NextResponse.json({
      slug,
      status: allReady ? "complete" : "generating",
      slides,
      manifest,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to connect to slide server", detail: String(error) },
      { status: 502 }
    );
  }
}
```

- [ ] **Step 2: Verify build**

Run: `pnpm build`
Expected: Builds successfully

- [ ] **Step 3: Commit**

```bash
git add src/app/api/studio/slides/route.ts
git commit -m "feat(studio): add slides polling API route with SSH fetch + storage upload"
```

---

### Task 5: Add Studio to sidebar navigation

**Files:**
- Modify: `src/lib/constants.ts`
- Modify: `src/components/sidebar.tsx`

- [ ] **Step 1: Add Studio nav section to constants**

In `src/lib/constants.ts`, add a new section between "COMPETITOR INTEL" and "SYSTEM":

```typescript
// Add after the COMPETITOR INTEL section:
  {
    section: "CREATE",
    items: [
      { label: "Studio", href: "/studio", icon: "Clapperboard" },
    ],
  },
```

- [ ] **Step 2: Add Clapperboard icon to sidebar**

In `src/components/sidebar.tsx`, add the import and map entry:

```typescript
// Add to imports:
import { ..., Clapperboard } from "lucide-react";

// Add to ICON_MAP:
Clapperboard,
```

- [ ] **Step 3: Update active state to match /studio/* routes**

In `src/components/sidebar.tsx`, update the `active` check in `SidebarNav` to handle nested studio routes:

```typescript
const active = pathname === item.href ||
  (item.href === "/studio" && pathname.startsWith("/studio"));
```

- [ ] **Step 4: Verify dev server**

Run: `pnpm dev`
Expected: Sidebar shows "CREATE" section with "Studio" link. Clicking it navigates to `/studio` (404 for now is fine).

- [ ] **Step 5: Commit**

```bash
git add src/lib/constants.ts src/components/sidebar.tsx
git commit -m "feat(studio): add Studio to sidebar navigation"
```

---

### Task 6: Studio landing page

**Files:**
- Create: `src/app/(dashboard)/studio/page.tsx`

- [ ] **Step 1: Create the landing page**

Create `src/app/(dashboard)/studio/page.tsx`:

```tsx
import Link from "next/link";
import { Images, Video, MessageSquare } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const FORMATS = [
  {
    id: "slideshows",
    title: "Slideshows",
    description: "6-slide photorealistic stories for TikTok",
    icon: Images,
    href: "/studio/slideshows",
    status: "active" as const,
  },
  {
    id: "ugc-hooks",
    title: "UGC Hooks",
    description: "Reaction videos with app screen reveals",
    icon: MessageSquare,
    href: null,
    status: "coming-soon" as const,
  },
  {
    id: "videos",
    title: "Videos",
    description: "Animated social media videos via Remotion",
    icon: Video,
    href: null,
    status: "coming-soon" as const,
  },
];

export default function StudioPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Studio</h1>
        <p className="text-muted-foreground">Create content for your social channels</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FORMATS.map((format) => {
          const Icon = format.icon;
          const isActive = format.status === "active";

          const card = (
            <Card
              key={format.id}
              className={
                isActive
                  ? "cursor-pointer transition-colors hover:border-primary/50"
                  : "opacity-50 cursor-not-allowed"
              }
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <Icon className="size-8 text-muted-foreground" />
                  <Badge variant={isActive ? "default" : "secondary"}>
                    {isActive ? "Active" : "Coming Soon"}
                  </Badge>
                </div>
                <CardTitle className="mt-3">{format.title}</CardTitle>
                <CardDescription>{format.description}</CardDescription>
              </CardHeader>
            </Card>
          );

          if (isActive && format.href) {
            return (
              <Link key={format.id} href={format.href}>
                {card}
              </Link>
            );
          }
          return <div key={format.id}>{card}</div>;
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify dev server**

Run: `pnpm dev`, navigate to `/studio`
Expected: See 3 format cards. "Slideshows" is clickable, others are dimmed.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(dashboard\)/studio/page.tsx
git commit -m "feat(studio): add landing page with format cards"
```

---

### Task 7: Slide polling hook

**Files:**
- Create: `src/components/studio/use-slide-polling.ts`

- [ ] **Step 1: Create the polling hook**

Create `src/components/studio/use-slide-polling.ts`:

```typescript
"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export type SlideStatus = "pending" | "generating" | "ready" | "failed";

export interface SlideState {
  index: number;
  url: string | null;
  status: SlideStatus;
}

export interface SlideshowState {
  slug: string | null;
  status: "idle" | "generating" | "complete" | "error";
  slides: SlideState[];
  manifest: Record<string, unknown> | null;
  error: string | null;
}

const EMPTY_SLIDES: SlideState[] = Array.from({ length: 6 }, (_, i) => ({
  index: i + 1,
  url: null,
  status: "pending" as const,
}));

export function useSlidePolling() {
  const [state, setState] = useState<SlideshowState>({
    slug: null,
    status: "idle",
    slides: EMPTY_SLIDES,
    manifest: null,
    error: null,
  });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    intervalRef.current = null;
    timeoutRef.current = null;
  }, []);

  const startPolling = useCallback(
    (slug: string) => {
      stopPolling();

      setState({
        slug,
        status: "generating",
        slides: EMPTY_SLIDES.map((s) => ({ ...s, status: "generating" })),
        manifest: null,
        error: null,
      });

      const poll = async () => {
        try {
          const res = await fetch(`/api/studio/slides?slug=${slug}`);
          if (!res.ok) throw new Error("Failed to fetch slides");
          const data = await res.json();

          setState((prev) => ({
            ...prev,
            slides: data.slides,
            manifest: data.manifest,
            status: data.status === "complete" ? "complete" : "generating",
          }));

          if (data.status === "complete") {
            stopPolling();
          }
        } catch (err) {
          setState((prev) => ({
            ...prev,
            error: String(err),
            status: "error",
          }));
          stopPolling();
        }
      };

      // Poll immediately, then every 5s
      poll();
      intervalRef.current = setInterval(poll, 5000);

      // Timeout after 10 minutes
      timeoutRef.current = setTimeout(() => {
        stopPolling();
        setState((prev) => ({
          ...prev,
          status: "error",
          error: "Generation timed out after 10 minutes",
        }));
      }, 10 * 60 * 1000);
    },
    [stopPolling]
  );

  const reset = useCallback(() => {
    stopPolling();
    setState({
      slug: null,
      status: "idle",
      slides: EMPTY_SLIDES,
      manifest: null,
      error: null,
    });
  }, [stopPolling]);

  // Cleanup on unmount
  useEffect(() => stopPolling, [stopPolling]);

  return { ...state, startPolling, stopPolling, reset };
}
```

- [ ] **Step 2: Verify build**

Run: `pnpm build`
Expected: Builds successfully

- [ ] **Step 3: Commit**

```bash
git add src/components/studio/use-slide-polling.ts
git commit -m "feat(studio): add slide polling hook"
```

---

### Task 8: Chat panel component

**Files:**
- Create: `src/components/studio/chat-panel.tsx`

- [ ] **Step 1: Create ChatPanel**

Create `src/components/studio/chat-panel.tsx`:

```tsx
"use client";

import { useChat } from "ai/react";
import { useEffect, useRef, useCallback } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ChatPanelProps {
  onSlugDetected: (slug: string) => void;
  appendRef?: React.MutableRefObject<((message: string) => void) | null>;
}

// Match MANIFEST:/path/to/posts/photo/{slug}/manifest.json
const MANIFEST_RE = /MANIFEST:.*\/posts\/photo\/([^/]+)\/manifest\.json/;
// Fallback: "generating slides for concept: {slug}" style
const SLUG_RE = /(?:generating|rendering).*?(?:slug|concept)[:\s]+["']?([a-z0-9-]+)/i;

export function ChatPanel({ onSlugDetected, appendRef }: ChatPanelProps) {
  const { messages, input, handleInputChange, handleSubmit, isLoading, append } =
    useChat({ api: "/api/studio/chat" });

  const scrollRef = useRef<HTMLDivElement>(null);
  const detectedSlugs = useRef<Set<string>>(new Set());

  // Expose append so parent can send messages programmatically (for regenerate/edit)
  useEffect(() => {
    if (appendRef) {
      appendRef.current = (text: string) => {
        append({ role: "user", content: text });
      };
    }
  }, [append, appendRef]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Detect slug from assistant messages
  useEffect(() => {
    for (const msg of messages) {
      if (msg.role !== "assistant") continue;
      const manifestMatch = msg.content.match(MANIFEST_RE);
      const slug = manifestMatch?.[1] ?? msg.content.match(SLUG_RE)?.[1];
      if (slug && !detectedSlugs.current.has(slug)) {
        detectedSlugs.current.add(slug);
        onSlugDetected(slug);
      }
    }
  }, [messages, onSlugDetected]);

  return (
    <div className="flex h-full flex-col border-r border-border">
      {/* Header */}
      <div className="flex h-12 shrink-0 items-center border-b border-border px-4">
        <h2 className="text-sm font-semibold">Chat</h2>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-muted-foreground">
              Describe a slideshow concept to get started
            </p>
          </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              "max-w-[85%] rounded-lg px-3 py-2 text-sm",
              msg.role === "user"
                ? "ml-auto bg-primary text-primary-foreground"
                : "bg-muted"
            )}
          >
            <p className="whitespace-pre-wrap">{msg.content}</p>
          </div>
        ))}
        {isLoading && messages[messages.length - 1]?.role === "user" && (
          <div className="max-w-[85%] rounded-lg bg-muted px-3 py-2">
            <div className="flex gap-1">
              <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground" />
              <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:0.1s]" />
              <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:0.2s]" />
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="flex shrink-0 items-center gap-2 border-t border-border p-3"
      >
        <input
          value={input}
          onChange={handleInputChange}
          placeholder="Describe your slideshow concept..."
          className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
        <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
          <Send className="size-4" />
        </Button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `pnpm build`
Expected: Builds successfully

- [ ] **Step 3: Commit**

```bash
git add src/components/studio/chat-panel.tsx
git commit -m "feat(studio): add ChatPanel component with slug detection"
```

---

### Task 9: Preview panel component

**Files:**
- Create: `src/components/studio/preview-panel.tsx`

- [ ] **Step 1: Create PreviewPanel**

Create `src/components/studio/preview-panel.tsx`:

```tsx
"use client";

import { Loader2, RotateCw, Pencil, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SlideState, SlideshowState } from "./use-slide-polling";

interface PreviewPanelProps {
  state: SlideshowState;
  onSlideClick: (index: number) => void;
  onRegenerate: () => void;
  onEditTexts: () => void;
  onDownload: () => void;
}

function SlideSlot({
  slide,
  onClick,
}: {
  slide: SlideState;
  onClick: () => void;
}) {
  if (slide.status === "ready" && slide.url) {
    return (
      <button
        onClick={onClick}
        className="group relative aspect-[2/3] w-full overflow-hidden rounded-md border border-border bg-muted transition-all hover:ring-2 hover:ring-primary"
      >
        <img
          src={slide.url}
          alt={`Slide ${slide.index}`}
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/20">
          <span className="text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
            {slide.index}
          </span>
        </div>
      </button>
    );
  }

  if (slide.status === "generating") {
    return (
      <div className="flex aspect-[2/3] w-full items-center justify-center rounded-md border border-border bg-muted">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // pending or failed
  return (
    <div className="flex aspect-[2/3] w-full items-center justify-center rounded-md border border-dashed border-border bg-muted/50">
      <span className="text-xs text-muted-foreground">{slide.index}</span>
    </div>
  );
}

export function PreviewPanel({
  state,
  onSlideClick,
  onRegenerate,
  onEditTexts,
  onDownload,
}: PreviewPanelProps) {
  const allReady = state.slides.every((s) => s.status === "ready");
  const hasAnySlide = state.slides.some((s) => s.status === "ready");

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex h-12 shrink-0 items-center border-b border-border px-4">
        <h2 className="text-sm font-semibold">Preview</h2>
        {state.status === "generating" && (
          <span className="ml-2 text-xs text-muted-foreground">
            Generating...
          </span>
        )}
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-2 gap-3">
          {state.slides.map((slide) => (
            <SlideSlot
              key={slide.index}
              slide={slide}
              onClick={() => onSlideClick(slide.index)}
            />
          ))}
        </div>

        {state.error && (
          <p className="mt-3 text-xs text-destructive">{state.error}</p>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex shrink-0 gap-2 border-t border-border p-3">
        <Button
          variant="outline"
          size="sm"
          onClick={onRegenerate}
          disabled={!hasAnySlide}
        >
          <RotateCw className="mr-1.5 size-3.5" />
          Regenerate
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onEditTexts}
          disabled={!state.manifest}
        >
          <Pencil className="mr-1.5 size-3.5" />
          Edit Texts
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onDownload}
          disabled={!allReady}
        >
          <Download className="mr-1.5 size-3.5" />
          Download
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `pnpm build`
Expected: Builds successfully

- [ ] **Step 3: Commit**

```bash
git add src/components/studio/preview-panel.tsx
git commit -m "feat(studio): add PreviewPanel with 2x3 grid and action buttons"
```

---

### Task 10: Slide lightbox component

**Files:**
- Create: `src/components/studio/slide-lightbox.tsx`

- [ ] **Step 1: Create SlideLightbox**

Create `src/components/studio/slide-lightbox.tsx`:

```tsx
"use client";

import { useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SlideState } from "./use-slide-polling";

interface SlideLightboxProps {
  slides: SlideState[];
  activeIndex: number | null;
  onClose: () => void;
  onNavigate: (index: number) => void;
}

export function SlideLightbox({
  slides,
  activeIndex,
  onClose,
  onNavigate,
}: SlideLightboxProps) {
  const readySlides = slides.filter((s) => s.status === "ready" && s.url);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && activeIndex !== null) {
        const prev = readySlides.findIndex((s) => s.index === activeIndex) - 1;
        if (prev >= 0) onNavigate(readySlides[prev].index);
      }
      if (e.key === "ArrowRight" && activeIndex !== null) {
        const next = readySlides.findIndex((s) => s.index === activeIndex) + 1;
        if (next < readySlides.length) onNavigate(readySlides[next].index);
      }
    },
    [activeIndex, onClose, onNavigate, readySlides]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  if (activeIndex === null) return null;

  const current = slides.find((s) => s.index === activeIndex);
  if (!current?.url) return null;

  const currentReadyIdx = readySlides.findIndex((s) => s.index === activeIndex);
  const hasPrev = currentReadyIdx > 0;
  const hasNext = currentReadyIdx < readySlides.length - 1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
      onClick={onClose}
    >
      <div
        className="relative max-h-[90vh] max-w-[90vw]"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={current.url}
          alt={`Slide ${activeIndex}`}
          className="max-h-[85vh] rounded-lg object-contain"
        />

        <Button
          variant="ghost"
          size="icon"
          className="absolute -right-12 top-0 text-white hover:bg-white/20"
          onClick={onClose}
        >
          <X className="size-5" />
        </Button>

        {hasPrev && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute -left-12 top-1/2 -translate-y-1/2 text-white hover:bg-white/20"
            onClick={() => onNavigate(readySlides[currentReadyIdx - 1].index)}
          >
            <ChevronLeft className="size-6" />
          </Button>
        )}

        {hasNext && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute -right-12 top-1/2 -translate-y-1/2 text-white hover:bg-white/20"
            onClick={() => onNavigate(readySlides[currentReadyIdx + 1].index)}
          >
            <ChevronRight className="size-6" />
          </Button>
        )}

        <div className="mt-2 text-center text-sm text-white/70">
          Slide {activeIndex} of 6
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/studio/slide-lightbox.tsx
git commit -m "feat(studio): add SlideLightbox modal with keyboard nav"
```

---

### Task 11: Edit texts dialog

**Files:**
- Create: `src/components/studio/edit-texts-dialog.tsx`

- [ ] **Step 1: Create EditTextsDialog**

Create `src/components/studio/edit-texts-dialog.tsx`:

```tsx
"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const SLIDE_LABELS = [
  "Slide 1 — Hook",
  "Slide 2 — Problem",
  "Slide 3 — Discovery",
  "Slide 4 — Reveal",
  "Slide 5 — Result",
  "Slide 6 — CTA",
];

interface EditTextsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTexts: string[];
  onSubmit: (texts: string[]) => void;
}

export function EditTextsDialog({
  open,
  onOpenChange,
  initialTexts,
  onSubmit,
}: EditTextsDialogProps) {
  const [texts, setTexts] = useState<string[]>(initialTexts);

  useEffect(() => {
    setTexts(initialTexts);
  }, [initialTexts]);

  const updateText = (index: number, value: string) => {
    setTexts((prev) => prev.map((t, i) => (i === index ? value : t)));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Slide Texts</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 max-h-[60vh] overflow-y-auto py-2">
          {texts.map((text, i) => (
            <div key={i}>
              <Label className="text-xs">{SLIDE_LABELS[i]}</Label>
              <textarea
                value={text}
                onChange={(e) => updateText(i, e.target.value)}
                rows={2}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => onSubmit(texts)}>Regenerate with new texts</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/studio/edit-texts-dialog.tsx
git commit -m "feat(studio): add EditTextsDialog component"
```

---

### Task 12: Slideshow studio page — wire everything together

**Files:**
- Create: `src/app/(dashboard)/studio/slideshows/page.tsx`

- [ ] **Step 1: Create the slideshow studio page**

Create `src/app/(dashboard)/studio/slideshows/page.tsx`:

```tsx
"use client";

import { useState, useCallback, useRef } from "react";
import { ChatPanel } from "@/components/studio/chat-panel";
import { PreviewPanel } from "@/components/studio/preview-panel";
import { SlideLightbox } from "@/components/studio/slide-lightbox";
import { EditTextsDialog } from "@/components/studio/edit-texts-dialog";
import { useSlidePolling } from "@/components/studio/use-slide-polling";
import JSZip from "jszip";

export default function SlideshowStudioPage() {
  const slideState = useSlidePolling();
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [editTextsOpen, setEditTextsOpen] = useState(false);
  const appendRef = useRef<((message: string) => void) | null>(null);

  const sendChatMessage = useCallback((text: string) => {
    appendRef.current?.(text);
  }, []);

  const handleSlugDetected = useCallback(
    (slug: string) => {
      slideState.startPolling(slug);
    },
    [slideState.startPolling]
  );

  const handleRegenerate = useCallback(() => {
    // Send a regenerate instruction through the chat so the agent handles it
    sendChatMessage("Regenerate all 6 slides for the current slideshow with the same concept and scene.");
    slideState.reset();
  }, [sendChatMessage, slideState.reset]);

  const handleEditTextsSubmit = useCallback(
    (texts: string[]) => {
      setEditTextsOpen(false);
      // Send updated texts to the agent via chat
      const textsFormatted = texts
        .map((t, i) => `Slide ${i + 1}: "${t}"`)
        .join("\n");
      sendChatMessage(
        `Regenerate the slideshow with these updated texts:\n${textsFormatted}`
      );
      slideState.reset();
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
    (slideState.manifest as { texts?: string[] })?.texts ??
    Array(6).fill("");

  return (
    <div className="flex h-[calc(100vh-3.5rem)] md:h-screen">
      {/* Chat — left panel */}
      <div className="w-1/2 min-w-[320px]">
        <ChatPanel onSlugDetected={handleSlugDetected} appendRef={appendRef} />
      </div>

      {/* Preview — right panel */}
      <div className="w-1/2 min-w-[320px]">
        <PreviewPanel
          state={slideState}
          onSlideClick={setLightboxIndex}
          onRegenerate={handleRegenerate}
          onEditTexts={() => setEditTextsOpen(true)}
          onDownload={handleDownload}
        />
      </div>

      {/* Lightbox */}
      <SlideLightbox
        slides={slideState.slides}
        activeIndex={lightboxIndex}
        onClose={() => setLightboxIndex(null)}
        onNavigate={setLightboxIndex}
      />

      {/* Edit texts */}
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

- [ ] **Step 2: Verify full build**

Run: `pnpm build`
Expected: Builds successfully with no errors

- [ ] **Step 3: Verify dev server end-to-end**

Run: `pnpm dev`, navigate to `/studio/slideshows`
Expected: Split panel layout — chat on left, empty 2x3 preview grid on right, action buttons at bottom of preview.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(dashboard\)/studio/slideshows/page.tsx
git commit -m "feat(studio): add slideshow studio page wiring chat + preview + lightbox + download"
```

---

### Task 13: Environment variables and Supabase storage bucket

**Files:**
- Modify: `.env.example` (or create if needed)

- [ ] **Step 1: Add env vars to .env.example**

Add these to `.env.example` (create if it doesn't exist):

```
# OpenClaw Gateway (Tailscale Funnel URL)
OPENCLAW_GATEWAY_URL=https://snehas-macbook-air-55.tail008b78.ts.net
OPENCLAW_GATEWAY_TOKEN=

# OpenClaw Mac SSH (for fetching generated slides)
OPENCLAW_SSH_HOST=100.120.211.69
OPENCLAW_SSH_USER=sneha
OPENCLAW_SSH_PRIVATE_KEY=  # base64-encoded private key

# Supabase Storage
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
STORAGE_BUCKET=slides
```

- [ ] **Step 2: Create Supabase storage bucket**

Using the Supabase dashboard or CLI, create a public bucket named `slides`.

- [ ] **Step 3: Set up Tailscale Funnel on Mac**

SSH into the Mac and run:
```bash
ssh sneha@100.120.211.69 "tailscale funnel 18789"
```

Verify the funnel URL works from your machine:
```bash
curl -s https://snehas-macbook-air-55.tail008b78.ts.net/v1/models \
  -H "Authorization: Bearer YOUR_TOKEN"
```

- [ ] **Step 4: Commit**

```bash
git add .env.example
git commit -m "feat(studio): add env vars for OpenClaw gateway, SSH, and storage"
```

---

### Task 14: Final integration test

- [ ] **Step 1: Verify full build**

```bash
pnpm build
```
Expected: Clean build, no errors.

- [ ] **Step 2: Manual end-to-end test**

1. Start dev server: `pnpm dev`
2. Navigate to `/studio` — see format cards
3. Click "Slideshows" — see split panel with chat + empty grid
4. Type: "Make a slideshow about USMLE weak areas with a female med student at a desk"
5. Chat streams agent response
6. When agent starts generating, preview grid shows spinners
7. Slides appear progressively in the grid
8. Click a slide — lightbox opens
9. Arrow keys navigate between slides
10. Click "Download" — downloads zip of all 6 PNGs
11. Click "Edit Texts" — dialog opens with slide texts

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat(studio): complete slideshow chat UI with progressive preview grid"
```
