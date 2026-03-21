# Social Dashboard Phase 1: Competitor Intel — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a TikTok competitor intelligence dashboard that tracks medical education creators, monitors video performance, detects viral content, and auto-classifies video formats using AI.

**Architecture:** Monolithic Next.js 15 app with Prisma ORM on PostgreSQL. Apify handles TikTok data scraping via scheduled cron + webhook ingestion. Gemini 3.1 Pro classifies video formats. Deployed on Vercel.

**Tech Stack:** Next.js 15, TypeScript, Tailwind CSS, shadcn/ui, Prisma, PostgreSQL (Neon), NextAuth.js, Apify, Gemini 3.1 Pro, TanStack Table, Vercel

**Spec:** `docs/superpowers/specs/2026-03-22-social-dashboard-design.md`

**Skill requirements:** Use @frontend-design for all UI pages. Use @browser-use to verify pages render correctly after each UI task.

---

## File Structure

```
social-dashboard/
├── prisma/
│   └── schema.prisma                    # Database schema (all models)
├── src/
│   ├── app/
│   │   ├── layout.tsx                   # Root layout (sidebar + providers)
│   │   ├── page.tsx                     # Redirect to /apps
│   │   ├── globals.css                  # Tailwind + custom styles
│   │   ├── apps/
│   │   │   └── page.tsx                 # Apps overview page
│   │   ├── accounts/
│   │   │   ├── page.tsx                 # Accounts list page
│   │   │   └── [username]/
│   │   │       └── page.tsx             # Account detail page
│   │   ├── research/
│   │   │   └── page.tsx                 # Account research page
│   │   ├── activity/
│   │   │   └── page.tsx                 # Posting activity page
│   │   ├── viral/
│   │   │   └── page.tsx                 # Viral videos page
│   │   ├── videos/
│   │   │   └── page.tsx                 # All videos page
│   │   ├── import/
│   │   │   └── page.tsx                 # Bulk import page
│   │   ├── settings/
│   │   │   └── page.tsx                 # Settings page
│   │   ├── sync/
│   │   │   └── page.tsx                 # Sync status page
│   │   ├── api/
│   │   │   ├── auth/[...nextauth]/
│   │   │   │   └── route.ts             # NextAuth API route
│   │   │   ├── sync/
│   │   │   │   ├── trigger/route.ts     # Cron trigger endpoint
│   │   │   │   └── webhook/route.ts     # Apify webhook endpoint
│   │   │   ├── apps/route.ts            # CRUD for apps
│   │   │   ├── accounts/route.ts        # CRUD for accounts
│   │   │   ├── classify/route.ts        # Manual re-classify endpoint
│   │   │   └── research/route.ts        # Account research/search
│   │   └── login/
│   │       └── page.tsx                 # Login page
│   ├── components/
│   │   ├── sidebar.tsx                  # Sidebar navigation
│   │   ├── summary-cards.tsx            # Reusable stat cards row
│   │   ├── app-badge.tsx                # Colored app label badge
│   │   ├── format-badge.tsx             # Video format badge
│   │   ├── viral-tier-badge.tsx         # Viral tier indicator (5K+, 50K+)
│   │   ├── video-grid.tsx              # Grid view for videos
│   │   ├── video-list-table.tsx        # List/table view for videos
│   │   ├── view-toggle.tsx             # Grid/List view switcher
│   │   ├── add-app-dialog.tsx          # Add app modal
│   │   ├── add-account-dialog.tsx      # Add account modal
│   │   ├── delete-confirm-dialog.tsx   # Generic delete confirmation
│   │   ├── data-table.tsx              # Generic TanStack Table wrapper
│   │   └── ui/                         # shadcn/ui components (auto-generated)
│   ├── lib/
│   │   ├── db.ts                        # Prisma client singleton
│   │   ├── auth.ts                      # NextAuth config
│   │   ├── apify.ts                     # Apify client + helpers
│   │   ├── gemini.ts                    # Gemini classification client
│   │   ├── utils.ts                     # Shared utilities (cn, formatNumber, etc.)
│   │   └── constants.ts                 # Default thresholds, format enum labels
│   └── types/
│       └── index.ts                     # Shared TypeScript types
├── .env.local                           # Local env vars (not committed)
├── .env.example                         # Template for env vars
├── vercel.json                          # Vercel cron config
├── next.config.ts                       # Next.js config
├── tailwind.config.ts                   # Tailwind config
├── package.json
└── tsconfig.json
```

---

## Task 1: Project Scaffolding & Database Schema

**Files:**
- Create: entire project scaffold
- Create: `prisma/schema.prisma`
- Create: `src/lib/db.ts`
- Create: `.env.example`

- [ ] **Step 1: Create Next.js 15 project**

```bash
cd /Users/shubh/workspace/oncourse/social-dashboard
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --turbopack --use-pnpm
```

Select defaults when prompted. This creates the Next.js 15 scaffold with App Router, TypeScript, Tailwind, and Turbopack.

- [ ] **Step 2: Install core dependencies**

```bash
cd /Users/shubh/workspace/oncourse/social-dashboard
pnpm add prisma @prisma/client next-auth @auth/prisma-adapter
pnpm add @tanstack/react-table apify-client @google/generative-ai
pnpm add date-fns lucide-react clsx tailwind-merge
pnpm add -D @types/node
```

- [ ] **Step 3: Initialize shadcn/ui**

```bash
cd /Users/shubh/workspace/oncourse/social-dashboard
npx shadcn@latest init -d
```

Then add needed components:

```bash
npx shadcn@latest add button card dialog input label select table badge dropdown-menu separator sheet toast tabs avatar tooltip
```

- [ ] **Step 4: Initialize Prisma**

```bash
cd /Users/shubh/workspace/oncourse/social-dashboard
npx prisma init
```

- [ ] **Step 5: Write the Prisma schema**

Write to `prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum VideoFormat {
  UGC_REACTION
  UGC_VOICEOVER
  TALKING_HEAD
  CAROUSEL_SLIDESHOW
  SCREEN_RECORDING
  SKIT_COMEDY
  GREEN_SCREEN
  TEXT_ON_SCREEN
  INTERVIEW_PODCAST
  WHITEBOARD
  BEFORE_AFTER
  ASMR_AESTHETIC
  OTHER
}

enum SyncStatus {
  RUNNING
  COMPLETED
  FAILED
}

model User {
  id        String   @id @default(uuid())
  email     String   @unique
  name      String?
  image     String?
  createdAt DateTime @default(now())

  accounts Account[] // NextAuth accounts (OAuth)
  sessions Session[] // NextAuth sessions
}

model Account {
  // NextAuth OAuth account model
  id                String  @id @default(uuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String?
  access_token      String?
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String?
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
  @@map("auth_accounts")
}

model Session {
  id           String   @id @default(uuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}

model App {
  id        String   @id @default(uuid())
  name      String   @unique
  color     String   @default("#3b82f6")
  url       String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  trackedAccounts TrackedAccount[]
}

model TrackedAccount {
  id             String    @id @default(uuid())
  username       String    @unique
  tiktokId       String?   @unique
  displayName    String?
  bio            String?
  avatarUrl      String?
  followers      Int       @default(0)
  totalLikes     Int       @default(0)
  totalVideos    Int       @default(0)
  trackingSince  DateTime  @default(now())
  lastSyncedAt   DateTime?
  lastPostedAt   DateTime?
  appId          String

  app       App                @relation(fields: [appId], references: [id], onDelete: Cascade)
  videos    Video[]
  snapshots AccountSnapshot[]

  @@index([appId])
  @@index([username])
}

model Video {
  id             String      @id @default(uuid())
  tiktokVideoId  String      @unique
  description    String      @default("")
  hashtags       String[]
  thumbnailUrl   String?
  videoUrl       String?
  duration       Int         @default(0)
  postedAt       DateTime
  views          Int         @default(0)
  likes          Int         @default(0)
  comments       Int         @default(0)
  shares         Int         @default(0)
  isCarousel     Boolean     @default(false)
  musicName      String?
  format         VideoFormat @default(OTHER)
  accountId      String

  account   TrackedAccount  @relation(fields: [accountId], references: [id], onDelete: Cascade)
  snapshots VideoSnapshot[]

  @@index([accountId])
  @@index([postedAt])
  @@index([views])
  @@index([format])
  @@index([tiktokVideoId])
}

model AccountSnapshot {
  id          String   @id @default(uuid())
  accountId   String
  followers   Int
  totalLikes  Int
  totalVideos Int
  recordedAt  DateTime @default(now())

  account TrackedAccount @relation(fields: [accountId], references: [id], onDelete: Cascade)

  @@unique([accountId, recordedAt])
  @@index([accountId, recordedAt])
}

model VideoSnapshot {
  id         String   @id @default(uuid())
  videoId    String
  views      Int
  likes      Int
  comments   Int
  shares     Int
  recordedAt DateTime @default(now())

  video Video @relation(fields: [videoId], references: [id], onDelete: Cascade)

  @@unique([videoId, recordedAt])
  @@index([videoId, recordedAt])
}

model SyncLog {
  id             String     @id @default(uuid())
  status         SyncStatus @default(RUNNING)
  startedAt      DateTime   @default(now())
  completedAt    DateTime?
  accountsSynced Int        @default(0)
  videosSynced   Int        @default(0)
  newVideos      Int        @default(0)
  errors         Json?
}

model Settings {
  id             String @id @default("default")
  viralThreshold1 Int   @default(5000)
  viralThreshold2 Int   @default(50000)
  apifyApiKey    String @default("")
  apifyActorId   String @default("")
  geminiApiKey   String @default("")
  syncCron       String @default("0 6 * * *")
}
```

- [ ] **Step 6: Create Prisma client singleton**

Write to `src/lib/db.ts`:

```typescript
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
```

- [ ] **Step 7: Create .env.example**

Write to `.env.example`:

```env
DATABASE_URL="postgresql://user:password@host:5432/social_dashboard"
NEXTAUTH_SECRET="generate-with-openssl-rand-base64-32"
NEXTAUTH_URL="http://localhost:3000"
APIFY_API_KEY=""
APIFY_ACTOR_ID=""
GEMINI_API_KEY=""
```

- [ ] **Step 8: Create .env.local with your database URL**

Copy `.env.example` to `.env.local` and fill in the `DATABASE_URL` pointing to your Neon/Supabase Postgres instance. Generate a `NEXTAUTH_SECRET` with `openssl rand -base64 32`.

- [ ] **Step 9: Run initial migration**

```bash
cd /Users/shubh/workspace/oncourse/social-dashboard
npx prisma migrate dev --name init
```

Expected: Migration succeeds, creates all tables.

- [ ] **Step 10: Verify Prisma client generates**

```bash
npx prisma generate
```

Expected: "Generated Prisma Client" success message.

- [ ] **Step 11: Create utility files**

Write to `src/lib/utils.ts`:

```typescript
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toString();
}

export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function getViralTier(
  views: number,
  threshold1: number = 5000,
  threshold2: number = 50000
): string | null {
  if (views >= threshold2) return "50K+";
  if (views >= 10000) return "10K+";
  if (views >= threshold1) return "5K+";
  return null;
}
```

Write to `src/lib/constants.ts`:

```typescript
import { VideoFormat } from "@prisma/client";

export const FORMAT_LABELS: Record<VideoFormat, string> = {
  UGC_REACTION: "UGC Reaction",
  UGC_VOICEOVER: "UGC Voiceover",
  TALKING_HEAD: "Talking Head",
  CAROUSEL_SLIDESHOW: "Carousel / Slideshow",
  SCREEN_RECORDING: "Screen Recording",
  SKIT_COMEDY: "Skit / Comedy",
  GREEN_SCREEN: "Green Screen",
  TEXT_ON_SCREEN: "Text on Screen",
  INTERVIEW_PODCAST: "Interview / Podcast",
  WHITEBOARD: "Whiteboard",
  BEFORE_AFTER: "Before / After",
  ASMR_AESTHETIC: "ASMR / Aesthetic",
  OTHER: "Other",
};

export const FORMAT_COLORS: Record<VideoFormat, string> = {
  UGC_REACTION: "#ef4444",
  UGC_VOICEOVER: "#f97316",
  TALKING_HEAD: "#eab308",
  CAROUSEL_SLIDESHOW: "#22c55e",
  SCREEN_RECORDING: "#06b6d4",
  SKIT_COMEDY: "#8b5cf6",
  GREEN_SCREEN: "#10b981",
  TEXT_ON_SCREEN: "#6366f1",
  INTERVIEW_PODCAST: "#ec4899",
  WHITEBOARD: "#14b8a6",
  BEFORE_AFTER: "#f59e0b",
  ASMR_AESTHETIC: "#a855f7",
  OTHER: "#6b7280",
};

export const DEFAULT_VIRAL_THRESHOLD_1 = 5000;
export const DEFAULT_VIRAL_THRESHOLD_2 = 50000;

export const NAV_ITEMS = [
  {
    section: "COMPETITOR INTEL",
    items: [
      { label: "Apps", href: "/apps", icon: "LayoutGrid" },
      { label: "Accounts", href: "/accounts", icon: "Users" },
      { label: "Account Research", href: "/research", icon: "Search" },
      { label: "Posting Activity", href: "/activity", icon: "Activity" },
      { label: "Viral Videos", href: "/viral", icon: "Flame" },
      { label: "All Videos", href: "/videos", icon: "Film" },
      { label: "Bulk Import", href: "/import", icon: "Upload" },
    ],
  },
  {
    section: "SYSTEM",
    items: [
      { label: "Settings", href: "/settings", icon: "Settings" },
      { label: "Sync Status", href: "/sync", icon: "RefreshCw" },
    ],
  },
] as const;
```

Write to `src/types/index.ts`:

```typescript
export type AppWithStats = {
  id: string;
  name: string;
  color: string;
  url: string | null;
  _count: { trackedAccounts: number };
  accountCount: number;
  totalFollowers: number;
  totalLikes: number;
  totalVideos: number;
  videos7d: number;
  viral5k: number;
  viral50k: number;
};

export type AccountWithStats = {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  followers: number;
  totalLikes: number;
  totalVideos: number;
  lastPostedAt: Date | null;
  lastSyncedAt: Date | null;
  trackingSince: Date;
  app: { id: string; name: string; color: string };
  videos7d: number;
  viral5k: number;
  viral10k: number;
  viral50k: number;
};
```

- [ ] **Step 12: Commit**

```bash
cd /Users/shubh/workspace/oncourse/social-dashboard
git init
echo "node_modules/\n.next/\n.env.local\n.superpowers/" > .gitignore
git add -A
git commit -m "feat: scaffold Next.js 15 project with Prisma schema and core utilities"
```

---

## Task 2: Auth & Layout Shell

**Files:**
- Create: `src/lib/auth.ts`
- Create: `src/app/api/auth/[...nextauth]/route.ts`
- Create: `src/app/login/page.tsx`
- Modify: `src/app/layout.tsx`
- Create: `src/components/sidebar.tsx`
- Create: `src/components/ui/` (shadcn components already added in Task 1)

- [ ] **Step 1: Configure NextAuth**

Write to `src/lib/auth.ts`:

```typescript
import { PrismaAdapter } from "@auth/prisma-adapter";
import { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { db } from "./db";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(db),
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email) return null;
        // Simple auth for small team — check if user exists
        const user = await db.user.findUnique({
          where: { email: credentials.email },
        });
        if (!user) {
          // Auto-create first user (seed)
          return db.user.create({
            data: { email: credentials.email, name: credentials.email.split("@")[0] },
          });
        }
        return user;
      },
    }),
  ],
  callbacks: {
    session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
};
```

Note: Install next-auth credentials provider:

```bash
pnpm add next-auth@4
```

- [ ] **Step 2: Create NextAuth route handler**

Write to `src/app/api/auth/[...nextauth]/route.ts`:

```typescript
import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
```

- [ ] **Step 3: Create login page**

Write to `src/app/login/page.tsx`:

```tsx
"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginPage() {
  const [email, setEmail] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await signIn("credentials", { email, callbackUrl: "/apps" });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-center">Social Dashboard</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="email"
              placeholder="you@oncourse.co"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Button type="submit" className="w-full">
              Sign In
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 4: Create sidebar component**

Use @frontend-design skill for high-quality sidebar that matches the reference tool's dark sidebar style.

Write to `src/components/sidebar.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutGrid, Users, Search, Activity, Flame, Film,
  Upload, Settings, RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "@/lib/constants";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutGrid, Users, Search, Activity, Flame, Film,
  Upload, Settings, RefreshCw,
};

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-60 flex-col border-r bg-card">
      <div className="flex h-14 items-center gap-2 border-b px-4">
        <div className="h-8 w-8 rounded-lg bg-primary" />
        <span className="font-semibold text-sm">Social Dashboard</span>
      </div>

      <nav className="flex-1 overflow-y-auto p-3 space-y-6">
        {NAV_ITEMS.map((section) => (
          <div key={section.section}>
            <p className="mb-2 px-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {section.section}
            </p>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = ICONS[item.icon];
                const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                        isActive
                          ? "bg-primary/10 text-primary font-medium"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      {Icon && <Icon className="h-4 w-4" />}
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t p-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className="h-2 w-2 rounded-full bg-green-500" />
          Synced
        </div>
      </div>
    </aside>
  );
}
```

- [ ] **Step 5: Update root layout with sidebar shell**

Modify `src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/sidebar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Social Dashboard — oncourse",
  description: "TikTok competitor intelligence for oncourse",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>
        <div className="flex h-screen">
          <Sidebar />
          <main className="flex-1 overflow-y-auto bg-background p-6">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
```

- [ ] **Step 6: Create root page redirect**

Write to `src/app/page.tsx`:

```tsx
import { redirect } from "next/navigation";

export default function Home() {
  redirect("/apps");
}
```

- [ ] **Step 7: Verify app runs**

```bash
cd /Users/shubh/workspace/oncourse/social-dashboard
pnpm dev
```

Use @browser-use to open http://localhost:3000 and verify: dark sidebar renders on the left, navigation links are visible, page redirects to /apps.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add auth, sidebar layout, and login page"
```

---

## Task 3: Shared UI Components

**Files:**
- Create: `src/components/summary-cards.tsx`
- Create: `src/components/app-badge.tsx`
- Create: `src/components/format-badge.tsx`
- Create: `src/components/viral-tier-badge.tsx`
- Create: `src/components/video-grid.tsx`
- Create: `src/components/video-list-table.tsx`
- Create: `src/components/view-toggle.tsx`
- Create: `src/components/data-table.tsx`

- [ ] **Step 1: Create summary cards component**

Write to `src/components/summary-cards.tsx`:

```tsx
import { Card, CardContent } from "@/components/ui/card";
import { formatNumber } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

export type StatCard = {
  label: string;
  value: number;
  icon?: LucideIcon;
  highlight?: boolean; // red text for viral counts
};

export function SummaryCards({ stats }: { stats: StatCard[] }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
      {stats.map((stat) => (
        <Card key={stat.label}>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{stat.label}</p>
            <p
              className={`mt-1 text-2xl font-bold ${
                stat.highlight ? "text-red-500" : ""
              }`}
            >
              {formatNumber(stat.value)}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Create badge components**

Write to `src/components/app-badge.tsx`:

```tsx
export function AppBadge({ name, color }: { name: string; color: string }) {
  return (
    <span
      className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium text-white"
      style={{ backgroundColor: color }}
    >
      {name}
    </span>
  );
}
```

Write to `src/components/format-badge.tsx`:

```tsx
import { VideoFormat } from "@prisma/client";
import { FORMAT_LABELS, FORMAT_COLORS } from "@/lib/constants";

export function FormatBadge({ format }: { format: VideoFormat }) {
  return (
    <span
      className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium text-white"
      style={{ backgroundColor: FORMAT_COLORS[format] }}
    >
      {FORMAT_LABELS[format]}
    </span>
  );
}
```

Write to `src/components/viral-tier-badge.tsx`:

```tsx
export function ViralTierBadge({ tier }: { tier: string | null }) {
  if (!tier) return null;

  const colors: Record<string, string> = {
    "5K+": "bg-yellow-500/20 text-yellow-500",
    "10K+": "bg-orange-500/20 text-orange-500",
    "50K+": "bg-red-500/20 text-red-500",
  };

  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-bold ${colors[tier] ?? ""}`}>
      {tier}
    </span>
  );
}
```

- [ ] **Step 3: Create view toggle**

Write to `src/components/view-toggle.tsx`:

```tsx
"use client";

import { LayoutGrid, List } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ViewToggle({
  view,
  onChange,
}: {
  view: "grid" | "list";
  onChange: (view: "grid" | "list") => void;
}) {
  return (
    <div className="flex items-center gap-1 rounded-md border p-0.5">
      <Button
        variant={view === "grid" ? "secondary" : "ghost"}
        size="icon"
        className="h-7 w-7"
        onClick={() => onChange("grid")}
      >
        <LayoutGrid className="h-4 w-4" />
      </Button>
      <Button
        variant={view === "list" ? "secondary" : "ghost"}
        size="icon"
        className="h-7 w-7"
        onClick={() => onChange("list")}
      >
        <List className="h-4 w-4" />
      </Button>
    </div>
  );
}
```

- [ ] **Step 4: Create video grid component**

Write to `src/components/video-grid.tsx`:

```tsx
import { Video } from "@prisma/client";
import { formatNumber, formatDate, getViralTier } from "@/lib/utils";
import { FormatBadge } from "./format-badge";
import { ViralTierBadge } from "./viral-tier-badge";
import { Eye, Heart, MessageCircle, Share2, ExternalLink } from "lucide-react";

export function VideoGrid({ videos }: { videos: Video[] }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      {videos.map((video) => (
        <a
          key={video.id}
          href={video.videoUrl ?? `https://www.tiktok.com/@/video/${video.tiktokVideoId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="group rounded-lg border bg-card overflow-hidden hover:border-primary/50 transition-colors"
        >
          {/* Thumbnail */}
          <div className="relative aspect-[9/16] bg-muted">
            {video.thumbnailUrl && (
              <img
                src={video.thumbnailUrl}
                alt=""
                className="h-full w-full object-cover"
                loading="lazy"
              />
            )}
            <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity">
              <ExternalLink className="h-8 w-8 text-white" />
            </div>
            {/* Stats overlay */}
            <div className="absolute bottom-0 left-0 right-0 flex items-center gap-3 bg-gradient-to-t from-black/80 to-transparent p-2 text-white text-xs">
              <span className="flex items-center gap-1">
                <Eye className="h-3 w-3" /> {formatNumber(video.views)}
              </span>
              <span className="flex items-center gap-1">
                <Heart className="h-3 w-3" /> {formatNumber(video.likes)}
              </span>
            </div>
            {/* Date */}
            <div className="absolute top-2 right-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
              {formatDate(video.postedAt)}
            </div>
          </div>

          {/* Info */}
          <div className="p-2 space-y-1">
            <p className="text-xs text-muted-foreground line-clamp-2">
              {video.description}
            </p>
            <div className="flex flex-wrap gap-1">
              {video.hashtags.slice(0, 3).map((tag) => (
                <span key={tag} className="text-[10px] text-primary">
                  #{tag}
                </span>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <FormatBadge format={video.format} />
              <ViralTierBadge tier={getViralTier(video.views)} />
            </div>
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-0.5">
                <MessageCircle className="h-2.5 w-2.5" /> {video.comments}
              </span>
              <span className="flex items-center gap-0.5">
                <Share2 className="h-2.5 w-2.5" /> {video.shares}
              </span>
            </div>
          </div>
        </a>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Create data table wrapper**

Write to `src/components/data-table.tsx`:

```tsx
"use client";

import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortingRowModel,
  SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowUpDown } from "lucide-react";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  onRowClick?: (row: TData) => void;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  onRowClick,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortingRowModel: getSortingRowModel(),
    onSortingChange: setSorting,
    state: { sorting },
  });

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  className={header.column.getCanSort() ? "cursor-pointer select-none" : ""}
                  onClick={header.column.getToggleSortingHandler()}
                >
                  <div className="flex items-center gap-1">
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                    {header.column.getCanSort() && (
                      <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
                    )}
                  </div>
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                className={onRowClick ? "cursor-pointer hover:bg-muted/50" : ""}
                onClick={() => onRowClick?.(row.original)}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center">
                No results.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
```

- [ ] **Step 6: Verify components render**

```bash
pnpm dev
```

Use @browser-use to verify the app loads without errors at http://localhost:3000.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add shared UI components (badges, cards, data table, video grid)"
```

---

## Task 4: Apps Overview Page

**Files:**
- Create: `src/app/apps/page.tsx`
- Create: `src/app/api/apps/route.ts`
- Create: `src/components/add-app-dialog.tsx`
- Create: `src/components/delete-confirm-dialog.tsx`

- [ ] **Step 1: Create API route for apps CRUD**

Write to `src/app/api/apps/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const apps = await db.app.findMany({
    include: {
      trackedAccounts: {
        include: {
          videos: { select: { views: true, postedAt: true } },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Fetch settings for thresholds
  const settings = await db.settings.findFirst({ where: { id: "default" } });
  const t1 = settings?.viralThreshold1 ?? 5000;
  const t2 = settings?.viralThreshold2 ?? 50000;

  const enriched = apps.map((app) => {
    const allVideos = app.trackedAccounts.flatMap((a) => a.videos);
    return {
      id: app.id,
      name: app.name,
      color: app.color,
      url: app.url,
      accountCount: app.trackedAccounts.length,
      totalFollowers: app.trackedAccounts.reduce((s, a) => s + a.followers, 0),
      totalLikes: app.trackedAccounts.reduce((s, a) => s + a.totalLikes, 0),
      totalVideos: allVideos.length,
      videos7d: allVideos.filter((v) => v.postedAt >= sevenDaysAgo).length,
      viral5k: allVideos.filter((v) => v.views >= t1).length,
      viral50k: allVideos.filter((v) => v.views >= t2).length,
    };
  });

  return NextResponse.json(enriched);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const app = await db.app.create({
    data: { name: body.name, color: body.color, url: body.url || null },
  });
  return NextResponse.json(app, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  await db.app.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 2: Create Add App dialog**

Write to `src/components/add-app-dialog.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus } from "lucide-react";

const PRESET_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#3b82f6", "#8b5cf6", "#ec4899", "#6366f1",
];

export function AddAppDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [url, setUrl] = useState("");
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch("/api/apps", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, color, url }),
    });
    setName("");
    setUrl("");
    setOpen(false);
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-1 h-4 w-4" /> Add App
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Competitor App</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>App Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Marrow" required />
          </div>
          <div>
            <Label>Color</Label>
            <div className="mt-1 flex gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`h-8 w-8 rounded-full border-2 ${color === c ? "border-white" : "border-transparent"}`}
                  style={{ backgroundColor: c }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
          </div>
          <div>
            <Label>Website URL (optional)</Label>
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." />
          </div>
          <Button type="submit" className="w-full">Add App</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: Create delete confirmation dialog**

Write to `src/components/delete-confirm-dialog.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Trash2 } from "lucide-react";

// Add alert-dialog to shadcn: npx shadcn@latest add alert-dialog

export function DeleteConfirmDialog({
  title,
  description,
  onConfirm,
}: {
  title: string;
  description: string;
  onConfirm: () => Promise<void>;
}) {
  const [loading, setLoading] = useState(false);

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
          <Trash2 className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={loading}
            onClick={async (e) => {
              e.preventDefault();
              setLoading(true);
              await onConfirm();
              setLoading(false);
            }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {loading ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

- [ ] **Step 4: Build the Apps Overview page**

Use @frontend-design skill. Match the reference tool's table layout with colored app badges, sortable columns, and summary cards at top.

Write to `src/app/apps/page.tsx`:

```tsx
import { db } from "@/lib/db";
import { SummaryCards } from "@/components/summary-cards";
import { AddAppDialog } from "@/components/add-app-dialog";
import { AppsTable } from "./apps-table";
import { LayoutGrid, Users, Film, Clock, Eye, Flame } from "lucide-react";

async function getAppsData() {
  const apps = await db.app.findMany({
    include: {
      trackedAccounts: {
        include: {
          videos: { select: { views: true, postedAt: true } },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  const settings = await db.settings.findFirst({ where: { id: "default" } });
  const t1 = settings?.viralThreshold1 ?? 5000;
  const t2 = settings?.viralThreshold2 ?? 50000;
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const enriched = apps.map((app) => {
    const allVideos = app.trackedAccounts.flatMap((a) => a.videos);
    return {
      id: app.id,
      name: app.name,
      color: app.color,
      url: app.url,
      accountCount: app.trackedAccounts.length,
      totalFollowers: app.trackedAccounts.reduce((s, a) => s + a.followers, 0),
      totalLikes: app.trackedAccounts.reduce((s, a) => s + a.totalLikes, 0),
      totalVideos: allVideos.length,
      videos7d: allVideos.filter((v) => v.postedAt >= sevenDaysAgo).length,
      viral5k: allVideos.filter((v) => v.views >= t1).length,
      viral50k: allVideos.filter((v) => v.views >= t2).length,
    };
  });

  const totals = {
    apps: enriched.length,
    accounts: enriched.reduce((s, a) => s + a.accountCount, 0),
    videos: enriched.reduce((s, a) => s + a.totalVideos, 0),
    videos7d: enriched.reduce((s, a) => s + a.videos7d, 0),
    viral5k: enriched.reduce((s, a) => s + a.viral5k, 0),
    viral50k: enriched.reduce((s, a) => s + a.viral50k, 0),
  };

  return { apps: enriched, totals };
}

export default async function AppsPage() {
  const { apps, totals } = await getAppsData();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Apps Overview</h1>
          <p className="text-sm text-muted-foreground">TikTok Research Tool by oncourse</p>
        </div>
        <AddAppDialog />
      </div>

      <SummaryCards
        stats={[
          { label: "Total Apps", value: totals.apps, icon: LayoutGrid },
          { label: "Total Accounts", value: totals.accounts, icon: Users },
          { label: "Total Videos", value: totals.videos, icon: Film },
          { label: "Videos (7d)", value: totals.videos7d, icon: Clock },
          { label: ">5K Views", value: totals.viral5k, icon: Eye, highlight: true },
          { label: ">50K Views", value: totals.viral50k, icon: Flame, highlight: true },
        ]}
      />

      <AppsTable apps={apps} />
    </div>
  );
}
```

Create the client-side table component at `src/app/apps/apps-table.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table";
import { AppBadge } from "@/components/app-badge";
import { DeleteConfirmDialog } from "@/components/delete-confirm-dialog";
import { formatNumber } from "@/lib/utils";
import { ExternalLink } from "lucide-react";
import type { AppWithStats } from "@/types";

const columns: ColumnDef<AppWithStats>[] = [
  {
    accessorKey: "name",
    header: "App",
    cell: ({ row }) => <AppBadge name={row.original.name} color={row.original.color} />,
  },
  { accessorKey: "accountCount", header: "Accounts", cell: ({ getValue }) => getValue<number>() },
  { accessorKey: "totalFollowers", header: "Followers", cell: ({ getValue }) => formatNumber(getValue<number>()) },
  { accessorKey: "totalLikes", header: "Likes", cell: ({ getValue }) => formatNumber(getValue<number>()) },
  { accessorKey: "totalVideos", header: "Videos", cell: ({ getValue }) => formatNumber(getValue<number>()) },
  { accessorKey: "videos7d", header: "7d" },
  {
    accessorKey: "viral5k",
    header: "5K+",
    cell: ({ getValue }) => {
      const val = getValue<number>();
      return <span className={val > 0 ? "font-bold text-yellow-500" : "text-muted-foreground"}>{val}</span>;
    },
  },
  {
    accessorKey: "viral50k",
    header: "50K+",
    cell: ({ getValue }) => {
      const val = getValue<number>();
      return <span className={val > 0 ? "font-bold text-red-500" : "text-muted-foreground"}>{val}</span>;
    },
  },
  {
    id: "actions",
    header: "Actions",
    enableSorting: false,
    cell: ({ row }) => <AppActions app={row.original} />,
  },
];

function AppActions({ app }: { app: AppWithStats }) {
  const router = useRouter();
  return (
    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      <DeleteConfirmDialog
        title={`Delete ${app.name}?`}
        description="This will remove the app and all its tracked accounts and videos. This action cannot be undone."
        onConfirm={async () => {
          await fetch(`/api/apps?id=${app.id}`, { method: "DELETE" });
          router.refresh();
        }}
      />
    </div>
  );
}

export function AppsTable({ apps }: { apps: AppWithStats[] }) {
  const router = useRouter();

  return (
    <DataTable
      columns={columns}
      data={apps}
      onRowClick={(app) => router.push(`/accounts?app=${app.id}`)}
    />
  );
}
```

- [ ] **Step 5: Add alert-dialog shadcn component**

```bash
npx shadcn@latest add alert-dialog
```

- [ ] **Step 6: Seed default settings**

Create `prisma/seed.ts`:

```typescript
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.settings.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default" },
  });
  console.log("Seeded default settings");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
```

Add to `package.json`:

```json
"prisma": { "seed": "tsx prisma/seed.ts" }
```

Install tsx and run seed:

```bash
pnpm add -D tsx
npx prisma db seed
```

- [ ] **Step 7: Verify Apps page renders**

```bash
pnpm dev
```

Use @browser-use to open http://localhost:3000/apps. Verify: summary cards show zeros, table shows "No results", Add App button opens dialog. Add a test app, verify it appears in the table with colored badge.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add Apps overview page with summary cards, sortable table, and CRUD"
```

---

## Task 5: Accounts Page & Account Detail

**Files:**
- Create: `src/app/accounts/page.tsx`
- Create: `src/app/accounts/accounts-table.tsx`
- Create: `src/app/accounts/[username]/page.tsx`
- Create: `src/app/accounts/[username]/account-videos.tsx`
- Create: `src/app/api/accounts/route.ts`
- Create: `src/components/add-account-dialog.tsx`

- [ ] **Step 1: Create accounts API route**

Write to `src/app/api/accounts/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const appId = searchParams.get("app");

  const where = appId ? { appId } : {};

  const accounts = await db.trackedAccount.findMany({
    where,
    include: {
      app: { select: { id: true, name: true, color: true } },
      videos: { select: { views: true, postedAt: true } },
    },
    orderBy: { lastPostedAt: "desc" },
  });

  const settings = await db.settings.findFirst({ where: { id: "default" } });
  const t1 = settings?.viralThreshold1 ?? 5000;
  const t2 = settings?.viralThreshold2 ?? 50000;
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const enriched = accounts.map((a) => ({
    ...a,
    videos7d: a.videos.filter((v) => v.postedAt >= sevenDaysAgo).length,
    viral5k: a.videos.filter((v) => v.views >= t1).length,
    viral10k: a.videos.filter((v) => v.views >= 10000).length,
    viral50k: a.videos.filter((v) => v.views >= t2).length,
    videos: undefined, // don't send raw videos array
  }));

  return NextResponse.json(enriched);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const account = await db.trackedAccount.create({
    data: {
      username: body.username.replace("@", ""),
      appId: body.appId,
    },
  });
  return NextResponse.json(account, { status: 201 });
}
```

- [ ] **Step 2: Create Add Account dialog**

Write to `src/components/add-account-dialog.tsx`:

```tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus } from "lucide-react";

type AppOption = { id: string; name: string; color: string };

export function AddAccountDialog({ apps }: { apps: AppOption[] }) {
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [appId, setAppId] = useState("");
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch("/api/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, appId }),
    });
    setUsername("");
    setOpen(false);
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-1 h-4 w-4" /> Add Account
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add TikTok Account</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>TikTok Username</Label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="@username"
              required
            />
          </div>
          <div>
            <Label>App</Label>
            <Select value={appId} onValueChange={setAppId} required>
              <SelectTrigger><SelectValue placeholder="Select app" /></SelectTrigger>
              <SelectContent>
                {apps.map((app) => (
                  <SelectItem key={app.id} value={app.id}>
                    {app.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" className="w-full" disabled={!appId}>
            Add Account
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: Build Accounts list page**

Write `src/app/accounts/page.tsx` as a server component that fetches accounts with app filter from search params, renders summary cards + sortable table. Include app dropdown filter and search input.

Write `src/app/accounts/accounts-table.tsx` as client component with TanStack Table columns matching the spec (username, app badge, last posted, followers, likes, videos, 7d, 5K+, 10K+, 50K+, actions). Row click navigates to `/accounts/[username]`.

- [ ] **Step 4: Build Account Detail page**

Write `src/app/accounts/[username]/page.tsx` as server component:
- Fetch account by username with all videos
- Render header (avatar, username, app badge, tracking since, "View on TikTok" link)
- Render stats cards (followers, total likes, total videos, viral videos)
- Render videos section with grid/list toggle

Write `src/app/accounts/[username]/account-videos.tsx` as client component:
- Grid/list toggle state
- Search input filtering by description/hashtags
- Format filter dropdown
- Uses VideoGrid and DataTable components
- List view columns: description, posted, views, likes, comments, shares, format badge, tier badge, external link

- [ ] **Step 5: Verify pages render**

Use @browser-use to verify:
- `/accounts` shows empty table, filter works
- Add an account manually, verify it appears
- Click account → detail page loads with header and empty videos section

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add Accounts list and Account Detail pages"
```

---

## Task 6: Apify Sync Pipeline

**Files:**
- Create: `src/lib/apify.ts`
- Create: `src/app/api/sync/trigger/route.ts`
- Create: `src/app/api/sync/webhook/route.ts`
- Create: `vercel.json`

- [ ] **Step 1: Create Apify client helper**

Write to `src/lib/apify.ts`:

```typescript
import { ApifyClient } from "apify-client";

export function getApifyClient() {
  const token = process.env.APIFY_API_KEY;
  if (!token) throw new Error("APIFY_API_KEY not configured");
  return new ApifyClient({ token });
}

export async function triggerTikTokScraper(usernames: string[]) {
  const client = getApifyClient();
  const actorId = process.env.APIFY_ACTOR_ID;
  if (!actorId) throw new Error("APIFY_ACTOR_ID not configured");

  const run = await client.actor(actorId).call({
    profiles: usernames,
    resultsPerPage: 50,
    shouldDownloadVideos: false,
    shouldDownloadCovers: false,
  }, {
    webhooks: [
      {
        eventTypes: ["ACTOR.RUN.SUCCEEDED"],
        requestUrl: `${process.env.NEXTAUTH_URL}/api/sync/webhook`,
      },
    ],
  });

  return run;
}
```

- [ ] **Step 2: Create sync trigger endpoint**

Write to `src/app/api/sync/trigger/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { triggerTikTokScraper } from "@/lib/apify";

export async function POST() {
  // Get all tracked usernames
  const accounts = await db.trackedAccount.findMany({
    select: { username: true },
  });

  if (accounts.length === 0) {
    return NextResponse.json({ message: "No accounts to sync" });
  }

  // Create sync log
  const syncLog = await db.syncLog.create({ data: {} });

  try {
    const usernames = accounts.map((a) => a.username);
    const run = await triggerTikTokScraper(usernames);

    return NextResponse.json({
      syncLogId: syncLog.id,
      apifyRunId: run.id,
      accountCount: usernames.length,
    });
  } catch (error) {
    await db.syncLog.update({
      where: { id: syncLog.id },
      data: {
        status: "FAILED",
        completedAt: new Date(),
        errors: { message: String(error) },
      },
    });
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
```

- [ ] **Step 3: Create webhook handler**

Write to `src/app/api/sync/webhook/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getApifyClient } from "@/lib/apify";
import { classifyVideoFormat } from "@/lib/gemini";

export async function POST(req: NextRequest) {
  const body = await req.json();

  // Get the Apify run results
  const client = getApifyClient();
  const datasetId = body.resource?.defaultDatasetId;
  if (!datasetId) {
    return NextResponse.json({ error: "No dataset ID" }, { status: 400 });
  }

  const dataset = await client.dataset(datasetId).listItems();
  const items = dataset.items;

  // Find most recent running sync log
  const syncLog = await db.syncLog.findFirst({
    where: { status: "RUNNING" },
    orderBy: { startedAt: "desc" },
  });

  let accountsSynced = 0;
  let videosSynced = 0;
  let newVideos = 0;
  const errors: Record<string, string> = {};

  for (const item of items) {
    try {
      // Each item is a profile with videos
      const username = (item.uniqueId as string) || (item.authorMeta?.name as string);
      if (!username) continue;

      const account = await db.trackedAccount.findUnique({
        where: { username },
      });
      if (!account) continue;

      // Update account metrics
      await db.trackedAccount.update({
        where: { id: account.id },
        data: {
          followers: (item.authorMeta?.fans as number) ?? account.followers,
          totalLikes: (item.authorMeta?.heart as number) ?? account.totalLikes,
          totalVideos: (item.authorMeta?.video as number) ?? account.totalVideos,
          displayName: (item.authorMeta?.nickName as string) ?? account.displayName,
          bio: (item.authorMeta?.signature as string) ?? account.bio,
          avatarUrl: (item.authorMeta?.avatar as string) ?? account.avatarUrl,
          tiktokId: (item.authorMeta?.id as string) ?? account.tiktokId,
          lastSyncedAt: new Date(),
        },
      });

      // Create account snapshot
      await db.accountSnapshot.create({
        data: {
          accountId: account.id,
          followers: (item.authorMeta?.fans as number) ?? account.followers,
          totalLikes: (item.authorMeta?.heart as number) ?? account.totalLikes,
          totalVideos: (item.authorMeta?.video as number) ?? account.totalVideos,
        },
      }).catch(() => {}); // Ignore duplicate snapshot for same day

      accountsSynced++;

      // Process videos
      const videos = (item.posts as any[]) || [];
      for (const video of videos) {
        const tiktokVideoId = String(video.id);

        const existing = await db.video.findUnique({
          where: { tiktokVideoId },
        });

        const videoData = {
          description: video.text || "",
          hashtags: (video.hashtags || []).map((h: any) => h.name || h),
          thumbnailUrl: video.covers?.default || video.videoMeta?.coverUrl || null,
          videoUrl: `https://www.tiktok.com/@${username}/video/${tiktokVideoId}`,
          duration: video.videoMeta?.duration || 0,
          postedAt: new Date((video.createTime || 0) * 1000),
          views: video.playCount || video.stats?.playCount || 0,
          likes: video.diggCount || video.stats?.diggCount || 0,
          comments: video.commentCount || video.stats?.commentCount || 0,
          shares: video.shareCount || video.stats?.shareCount || 0,
          isCarousel: video.imagePost?.images?.length > 0 || false,
          musicName: video.musicMeta?.musicName || null,
        };

        if (existing) {
          await db.video.update({
            where: { id: existing.id },
            data: videoData,
          });
        } else {
          const created = await db.video.create({
            data: {
              tiktokVideoId,
              accountId: account.id,
              ...videoData,
            },
          });

          // Classify format for new videos
          try {
            const format = await classifyVideoFormat({
              description: videoData.description,
              hashtags: videoData.hashtags,
              duration: videoData.duration,
              musicName: videoData.musicName,
              thumbnailUrl: videoData.thumbnailUrl,
            });
            await db.video.update({
              where: { id: created.id },
              data: { format },
            });
          } catch (classifyError) {
            // Leave as OTHER if classification fails
          }

          newVideos++;
        }

        // Create video snapshot
        const videoRecordId = existing ? existing.id : created.id;
        await db.videoSnapshot.create({
          data: {
            videoId: videoRecordId,
            views: videoData.views,
            likes: videoData.likes,
            comments: videoData.comments,
            shares: videoData.shares,
          },
        }).catch(() => {}); // Ignore duplicate

        videosSynced++;
      }

      // Update lastPostedAt
      const latestVideo = await db.video.findFirst({
        where: { accountId: account.id },
        orderBy: { postedAt: "desc" },
        select: { postedAt: true },
      });
      if (latestVideo) {
        await db.trackedAccount.update({
          where: { id: account.id },
          data: { lastPostedAt: latestVideo.postedAt },
        });
      }
    } catch (err) {
      errors[String(item.uniqueId)] = String(err);
    }
  }

  // Update sync log
  if (syncLog) {
    await db.syncLog.update({
      where: { id: syncLog.id },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        accountsSynced,
        videosSynced,
        newVideos,
        errors: Object.keys(errors).length > 0 ? errors : undefined,
      },
    });
  }

  return NextResponse.json({ accountsSynced, videosSynced, newVideos });
}
```

- [ ] **Step 4: Create Vercel cron config**

Write to `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/sync/trigger",
      "schedule": "0 6 * * *"
    }
  ]
}
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add Apify sync pipeline with cron trigger and webhook handler"
```

---

## Task 7: Gemini Format Classification

**Files:**
- Create: `src/lib/gemini.ts`

- [ ] **Step 1: Create Gemini classification client**

Write to `src/lib/gemini.ts`:

```typescript
import { GoogleGenerativeAI } from "@google/generative-ai";
import { VideoFormat } from "@prisma/client";

const VALID_FORMATS = Object.values(VideoFormat) as string[];

const CLASSIFICATION_PROMPT = `Classify this TikTok video into exactly one format category based on the metadata provided.

Video metadata:
- Description: {description}
- Hashtags: {hashtags}
- Duration: {duration}s
- Music: {musicName}

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

Respond with ONLY a JSON object: {"format": "<CATEGORY>"}`;

export async function classifyVideoFormat(video: {
  description: string;
  hashtags: string[];
  duration: number;
  musicName: string | null;
  thumbnailUrl: string | null;
}): Promise<VideoFormat> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return VideoFormat.OTHER;

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

  const prompt = CLASSIFICATION_PROMPT
    .replace("{description}", video.description)
    .replace("{hashtags}", video.hashtags.join(", "))
    .replace("{duration}", String(video.duration))
    .replace("{musicName}", video.musicName || "Unknown");

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    // Parse JSON response
    const match = text.match(/\{[^}]+\}/);
    if (!match) return VideoFormat.OTHER;

    const parsed = JSON.parse(match[0]);
    const format = parsed.format as string;

    if (VALID_FORMATS.includes(format)) {
      return format as VideoFormat;
    }
    return VideoFormat.OTHER;
  } catch {
    return VideoFormat.OTHER;
  }
}
```

Note: The spec says "Gemini 3.1 Pro" — use the latest available Gemini model ID. Adjust the model string when the actual model is available.

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat: add Gemini video format classification"
```

---

## Task 8: Viral Videos & All Videos Pages

**Files:**
- Create: `src/app/viral/page.tsx`
- Create: `src/app/videos/page.tsx`

- [ ] **Step 1: Build Viral Videos page**

Write `src/app/viral/page.tsx` as server component:
- Query videos with views >= threshold1 (from Settings)
- Include account + app relations for badges
- Filters: app dropdown, format dropdown, date range, threshold selector
- Grid/list toggle (client component wrapper)
- Sort by: views (default), likes, recency
- Each video shows: thumbnail, creator username, app badge, views, likes, format badge, posted date
- Click opens TikTok in new tab

- [ ] **Step 2: Build All Videos page**

Write `src/app/videos/page.tsx` as server component:
- Query all videos with pagination (cursor-based, 50 per page)
- Include account + app relations
- Filters: search (description/hashtags), app, account, format, date range, min views
- Grid/list toggle
- Sort by any column
- Pagination controls (Previous / Next)

- [ ] **Step 3: Verify pages**

Use @browser-use to check both pages render with empty states. If you seeded test data, verify filters and sorting work.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add Viral Videos and All Videos pages"
```

---

## Task 9: Remaining Pages (Research, Activity, Import, Settings, Sync)

**Files:**
- Create: `src/app/research/page.tsx`
- Create: `src/app/api/research/route.ts`
- Create: `src/app/activity/page.tsx`
- Create: `src/app/import/page.tsx`
- Create: `src/app/settings/page.tsx`
- Create: `src/app/sync/page.tsx`

- [ ] **Step 1: Build Account Research page**

Write `src/app/research/page.tsx`:
- Search input for TikTok username
- API route `/api/research` that calls Apify to look up a profile
- Display preview card: avatar, username, followers, likes, bio
- "Add to Tracking" button → select app → creates TrackedAccount
- Show recently searched accounts

- [ ] **Step 2: Build Posting Activity page**

Write `src/app/activity/page.tsx`:
- Query all videos grouped by day-of-week and hour
- Render a heatmap grid (7 rows × 24 columns) showing posting density
- Filter by app and date range
- Summary: "Most posts on [Day] at [Time]"

- [ ] **Step 3: Build Bulk Import page**

Write `src/app/import/page.tsx`:
- Textarea for pasting usernames (one per line)
- App selector dropdown
- "Preview" button → shows list of usernames with status (new / already tracked)
- "Import" button → creates TrackedAccount records for new ones
- Progress indicator + results summary

- [ ] **Step 4: Build Settings page**

Write `src/app/settings/page.tsx`:
- Form with fields from Settings model
- Viral Threshold 1 (number input, default 5000)
- Viral Threshold 2 (number input, default 50000)
- Apify API Key (password input)
- Apify Actor ID (text input)
- Gemini API Key (password input)
- Sync Schedule (text input showing cron expression)
- Save button → upserts Settings record

Create API route `src/app/api/settings/route.ts` for GET/PUT.

- [ ] **Step 5: Build Sync Status page**

Write `src/app/sync/page.tsx`:
- Show last sync timestamp at top
- "Sync Now" button → calls POST `/api/sync/trigger`
- Table of SyncLog records: date, status badge (green/yellow/red), accounts synced, videos synced, new videos, errors
- Auto-refresh while a sync is running

- [ ] **Step 6: Verify all pages**

Use @browser-use to navigate through every page in the sidebar and verify they render without errors.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add Research, Activity, Import, Settings, and Sync pages"
```

---

## Task 10: Polish & Deploy

**Files:**
- Modify: various files for visual polish
- Create: `.gitignore` updates

- [ ] **Step 1: Visual polish pass**

Use @frontend-design skill to review all pages and ensure:
- Consistent spacing and typography
- Dark theme looks polished (not default gray)
- Tables align with reference tool's aesthetic
- Mobile responsiveness (sidebar collapses)
- Loading states for server components (add `loading.tsx` files)

- [ ] **Step 2: Add loading states**

Create `src/app/apps/loading.tsx`, `src/app/accounts/loading.tsx`, etc.:

```tsx
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
      <Skeleton className="h-96" />
    </div>
  );
}
```

Add skeleton to shadcn:

```bash
npx shadcn@latest add skeleton
```

- [ ] **Step 3: Add .gitignore entries**

Ensure `.gitignore` includes:

```
node_modules/
.next/
.env.local
.superpowers/
```

- [ ] **Step 4: Build check**

```bash
pnpm build
```

Fix any TypeScript errors.

- [ ] **Step 5: Deploy to Vercel**

```bash
# Install Vercel CLI if needed
pnpm add -g vercel

# Deploy
vercel
```

Follow prompts to connect to your Vercel account and deploy. Set environment variables in Vercel dashboard.

- [ ] **Step 6: Verify deployment**

Use @browser-use to open the deployed URL and verify:
- Login page works
- Sidebar navigation works
- Apps page renders
- Sync Now triggers without errors (once Apify keys are configured)

- [ ] **Step 7: Final commit**

```bash
git add -A
git commit -m "feat: add loading states, polish, and Vercel deployment config"
```

---

## Summary

| Task | Description | Estimated Steps |
|------|-------------|----------------|
| 1 | Project scaffolding & database schema | 12 |
| 2 | Auth & layout shell | 8 |
| 3 | Shared UI components | 7 |
| 4 | Apps Overview page | 8 |
| 5 | Accounts & Account Detail pages | 6 |
| 6 | Apify sync pipeline | 5 |
| 7 | Gemini format classification | 2 |
| 8 | Viral Videos & All Videos pages | 4 |
| 9 | Remaining pages (Research, Activity, Import, Settings, Sync) | 7 |
| 10 | Polish & deploy | 7 |
| **Total** | | **66 steps** |
